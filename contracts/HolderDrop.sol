// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {MerkleProof} from "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

import {Rescuable} from "./Rescuable.sol";

/**
 * Half of everything, paid back to the people holding $CROCARD — in $CROCARD.
 *
 * Splitter buys the token on the way, so what arrives here is already what the
 * holders are owed. They are paid more of the thing they already hold, which is
 * the maker's call and the reason every stream now goes through the market
 * rather than around it.
 *
 * ── WHAT A HOLDER SEES ───────────────────────────────────────────────────────
 *
 * A number that goes up every day, and one button. Press it whenever you like
 * and everything accrued so far arrives. Leave it a year and it is still there,
 * and pressing it once collects the year.
 *
 * ── HOW THAT WORKS: A CUMULATIVE TREE ────────────────────────────────────────
 *
 * The tree does not say "your share of this week". It says WHAT YOU HAVE EARNED
 * IN TOTAL, ever, and the contract remembers what you have already taken. A
 * claim pays the difference. So republishing the tree with a bigger number is
 * the whole of "you earned more", and it costs a holder who is not watching
 * exactly nothing.
 *
 * This replaced a design with one tree per round and a separate claim for each.
 * That version was correct and nobody would have used it: a round a day meant a
 * holder facing ninety open rounds and ninety transactions inside the ninety-day
 * window, so the rounds had to be weekly to be bearable, which made the reward
 * feel like a payday rather than something that accrues. There is no window here
 * and nothing expires, because there is nothing to expire — an entitlement is
 * not a round that closes.
 *
 * ── WHY PUBLISHING IS SLOW ON PURPOSE ────────────────────────────────────────
 *
 * A cumulative tree is more dangerous than a per-round one. A stolen publisher
 * key cannot take anything — it holds no tokens and the invariant below means it
 * cannot promise what has not arrived — but it could publish a tree that moves
 * everybody's unclaimed entitlement to an address of its choosing. Under the old
 * design the same theft reached one round's worth.
 *
 * So a root does not go live when it is published. It waits PUBLISH_DELAY, in
 * the open, where `pendingRoot` is a public variable and `RootProposed` is an
 * event — and the owner, which is a cold wallet that never touches a server, can
 * throw it away with one transaction. A thief has to publish a root and then
 * wait a day in full view of the person who can cancel it.
 *
 * The daily job publishes and the next day's job adopts, so the live tree is a
 * day behind. That is a day of accrual a holder cannot claim yet, on a balance
 * that has been accruing for weeks. Nobody notices, and it is the difference
 * between a key that is worth stealing and one that is not.
 *
 * ── THE INVARIANT ────────────────────────────────────────────────────────────
 *
 *     promised <= paidOut + balanceOf(this)
 *
 * Checked when a root is proposed. It says the tree never promises more than has
 * actually arrived here, and it holds forever once true: a claim moves the same
 * amount from `balanceOf` to `paidOut`, so the right-hand side does not fall,
 * and tokens arriving only raise it. Which means every claim this contract
 * acknowledges can be paid, and the last holder to press the button gets the
 * same as the first.
 *
 * ── WHO PAYS THE GAS ─────────────────────────────────────────────────────────
 *
 * `claim` pays the holder named in the proof, not whoever called it. So a holder
 * can take their own, or anything can push it to them — the same shape PrizePot
 * uses, and for the same reason: a share that has to be fetched is a share
 * somebody forgets to fetch.
 */
contract HolderDrop is Rescuable {
    /// @notice How long a proposed root waits before it can be adopted.
    uint256 public constant PUBLISH_DELAY = 24 hours;

    /// @notice What a share is paid in.
    IERC20 public immutable card;

    /// @notice The only address that may propose a root. Rotatable by the owner.
    address public publisher;

    /// @notice The live tree. Leaves are (holder, everything they have earned).
    bytes32 public root;

    /// @notice What the live tree promises in total, across every holder.
    uint256 public promised;

    /// @notice A root waiting out its delay, or zero when there is none.
    bytes32 public pendingRoot;
    /// @notice What that root would promise.
    uint256 public pendingPromised;
    /// @notice When it may be adopted. Zero means nothing is pending.
    uint256 public pendingAt;

    /**
     * @notice What each holder has taken, ever.
     *
     * The other half of the cumulative design: the tree says what somebody has
     * earned and this says what they have already had, so a claim is the
     * difference and claiming twice pays nothing the second time.
     *
     * It is also the number the site shows under "received", which is why it is
     * public — the alternative is reading back every Claimed log ever emitted,
     * and Cronos answers eth_getLogs over two thousand blocks at a time.
     */
    mapping(address => uint256) public taken;

    /// @notice Everything this contract has ever paid out.
    uint256 public paidOut;

    event RootProposed(bytes32 root, uint256 promised, uint256 liveAt);
    event RootAdopted(bytes32 root, uint256 promised);
    event RootDropped(bytes32 root);
    event Claimed(address indexed holder, uint256 amount, uint256 total);
    event PublisherChanged(address indexed from, address indexed to);

    error NotThePublisher();
    error NothingPending();
    error NotReadyYet(uint256 readyAt);
    error AlreadyPending(bytes32 root, uint256 liveAt);
    error PromisesLessThanBefore(uint256 promised, uint256 before);
    error PromisesWhatIsNotHere(uint256 promised, uint256 available);
    error NoRoot();
    error BadProof();
    error NothingToClaim();
    error TokenTransferFailed();

    constructor(IERC20 card_, address publisher_) Ownable(msg.sender) {
        if (address(card_) == address(0) || publisher_ == address(0)) revert ZeroAddress();
        card = card_;
        publisher = publisher_;
    }

    /**
     * @notice Proposes the next cumulative tree. It goes live after the delay.
     *
     * `total` is what every leaf in the tree adds up to. It is checked rather
     * than trusted, against two things.
     *
     * It may not go down. A cumulative tree only grows — somebody's lifetime
     * entitlement cannot shrink — so a smaller total is a mistake or a theft and
     * either way is not something to accept quietly.
     *
     * And it may not exceed what has arrived. That is the invariant this whole
     * contract rests on: promise only what is here, and every claim is payable
     * forever after.
     */
    function propose(bytes32 newRoot, uint256 total) external {
        if (msg.sender != publisher) revert NotThePublisher();
        if (newRoot == bytes32(0)) revert NoRoot();
        // One at a time. Two pending roots would need a queue, and a queue of
        // things that take effect by themselves is a thing to get wrong.
        if (pendingAt != 0) revert AlreadyPending(pendingRoot, pendingAt);
        if (total < promised) revert PromisesLessThanBefore(total, promised);

        uint256 available = paidOut + card.balanceOf(address(this));
        if (total > available) revert PromisesWhatIsNotHere(total, available);

        pendingRoot = newRoot;
        pendingPromised = total;
        pendingAt = block.timestamp + PUBLISH_DELAY;
        emit RootProposed(newRoot, total, pendingAt);
    }

    /**
     * @notice Makes the pending root live, once it has waited.
     *
     * Anyone may call it. There is nothing to decide here — the root was fixed
     * when it was proposed and the delay is what it was for — so this is gas
     * somebody spends on everybody's behalf, and the cron spending it is a
     * convenience rather than a permission.
     */
    function adopt() external {
        if (pendingAt == 0) revert NothingPending();
        if (block.timestamp < pendingAt) revert NotReadyYet(pendingAt);

        root = pendingRoot;
        promised = pendingPromised;
        emit RootAdopted(root, promised);

        pendingRoot = bytes32(0);
        pendingPromised = 0;
        pendingAt = 0;
    }

    /**
     * @notice Throws away a pending root before it goes live.
     *
     * The answer to a publisher key that has been stolen, and the reason the
     * delay exists. The owner is a wallet that never touches a server, so the
     * key that can do this is not the key that can be taken from a Worker.
     */
    function dropPending() external onlyOwner {
        if (pendingAt == 0) revert NothingPending();
        emit RootDropped(pendingRoot);
        pendingRoot = bytes32(0);
        pendingPromised = 0;
        pendingAt = 0;
    }

    /**
     * @notice Pays a holder everything they have earned and not yet taken.
     *
     * `earned` is the number in the tree: everything, ever, and not what is new.
     * So one proof keeps working until the tree is republished, and a second
     * call with the same proof reverts with NothingToClaim rather than costing
     * gas to move zero — a transaction that does nothing and says nothing is the
     * one a holder cannot tell from a bug.
     */
    function claim(address holder, uint256 earned, bytes32[] calldata proof) external {
        if (root == bytes32(0)) revert NoRoot();

        bytes32 leaf = keccak256(bytes.concat(keccak256(abi.encode(holder, earned))));
        if (!MerkleProof.verify(proof, root, leaf)) revert BadProof();

        uint256 had = taken[holder];
        if (earned <= had) revert NothingToClaim();
        uint256 owed = earned - had;

        // Effects before interactions. A holder that calls back in finds their
        // tally already at `earned` and gets NothingToClaim.
        taken[holder] = earned;
        paidOut += owed;

        if (!card.transfer(holder, owed)) revert TokenTransferFailed();
        emit Claimed(holder, owed, earned);
    }

    /**
     * @notice Replaces the publisher.
     *
     * The answer to a leaked key, alongside `dropPending`. It cannot reach a
     * root already adopted — which is deliberate, because a holder who has been
     * told what they have earned should not have it taken back by a rotation.
     */
    function setPublisher(address publisher_) external onlyOwner {
        if (publisher_ == address(0)) revert ZeroAddress();
        emit PublisherChanged(publisher, publisher_);
        publisher = publisher_;
    }

    /// @notice What is owed to everybody who has not claimed yet.
    function outstanding() external view returns (uint256) {
        return promised - paidOut;
    }

    /**
     * @notice What has arrived and is not promised to anybody yet.
     *
     * What the next tree may add up to, over and above what the live one says.
     */
    function unpromised() external view returns (uint256) {
        return paidOut + card.balanceOf(address(this)) - promised;
    }
}
