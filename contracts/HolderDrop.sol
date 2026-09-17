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
 * ── WHY A TREE AND NOT A LIST ────────────────────────────────────────────────
 *
 * $CROCARD has a billion supply and thousands of holders. Paying them by sending
 * thousands of transfers costs more gas than the smallest shares are worth —
 * there is an amount below which the transfer costs more than it moves, and a
 * long tail of holders sit under it. Storing thousands of balances on chain to
 * be read later has the same problem with different words.
 *
 * So the round is one number: a merkle root. Each holder's share is proved
 * against it when it is taken, and a holder who never takes theirs costs nothing
 * to have included.
 *
 * ── WHO PAYS THE GAS ─────────────────────────────────────────────────────────
 *
 * `claim` pays the holder named in the proof, not whoever called it. So a holder
 * can take their own, or anything can push it to them — the same shape PrizePot
 * uses, and for the same reason: a share that has to be fetched is a share
 * somebody forgets to fetch. Pushing the small ones is a choice about gas rather
 * than a thing the contract cares about.
 *
 * ── WHAT THE PUBLISHER CAN AND CANNOT DO ─────────────────────────────────────
 *
 * It may open a round with a root. It cannot withdraw, cannot change a round it
 * has opened, and cannot take anybody's share — the tree decides who gets what
 * and the tree is fixed the moment the round opens. A stolen key can publish one
 * bad root for the CRO that has arrived since the last round, once, in public.
 * The owner rotates it.
 *
 * ── WHAT IS NOT TAKEN COMES BACK ─────────────────────────────────────────────
 *
 * A round expires. What nobody claimed returns to the unallocated balance and is
 * divided again in a later round, rather than sitting here forever as a number
 * nothing can pay out. Without that, every round's dust is stranded and
 * `allocated` only ever grows — the same leftover this project refuses in
 * lib/revenue.ts, in a slower form.
 */
contract HolderDrop is Rescuable {
    struct Round {
        bytes32 root;
        /// Everything set aside for this round.
        uint256 amount;
        /// How much of it has been taken.
        uint256 taken;
        /// After this, what is left can be swept back.
        uint256 expiresAt;
        bool swept;
    }

    /// @notice How long a holder has to take their share before it is recycled.
    uint256 public constant CLAIM_WINDOW = 90 days;

    /// @notice What a share is paid in.
    IERC20 public immutable card;

    /// @notice The only address that may open a round. Rotatable by the owner.
    address public publisher;

    mapping(uint256 => Round) public rounds;
    /// @notice Who has taken their share of which round.
    mapping(uint256 => mapping(address => bool)) public claimed;

    /// @notice What is spoken for across every open round.
    uint256 public allocated;

    event RoundOpened(uint256 indexed round, bytes32 root, uint256 amount, uint256 expiresAt);
    event Claimed(uint256 indexed round, address indexed holder, uint256 amount);
    event Swept(uint256 indexed round, uint256 amount);
    event PublisherChanged(address indexed from, address indexed to);

    error NotThePublisher();
    error RoundAlreadyOpen();
    error NoSuchRound();
    error NothingToShare();
    error AlreadyClaimed();
    error BadProof();
    error NotExpiredYet(uint256 at);
    error AlreadySwept();
    error TooMuchClaimed();
    error TokenTransferFailed();

    constructor(IERC20 card_, address publisher_) Ownable(msg.sender) {
        if (address(card_) == address(0) || publisher_ == address(0)) revert ZeroAddress();
        card = card_;
        publisher = publisher_;
    }

    /**
     * Nothing to receive. Tokens arrive by being transferred here, which needs no
     * code — and a payable receive() would now only let somebody strand CRO in a
     * contract with no way to pay it out. The rescue hatch gets that back.
     */

    /**
     * @notice Sets aside everything unspoken-for and fixes who it belongs to.
     *
     * The amount is whatever has arrived since the last round, read now rather
     * than at claim time — so CRO landing mid-round belongs to the next one and
     * cannot change what a holder was told they were owed.
     */
    function openRound(uint256 round, bytes32 root) external {
        if (msg.sender != publisher) revert NotThePublisher();
        if (rounds[round].root != bytes32(0)) revert RoundAlreadyOpen();
        if (root == bytes32(0)) revert BadProof();

        uint256 amount = card.balanceOf(address(this)) - allocated;
        if (amount == 0) revert NothingToShare();

        rounds[round] = Round({
            root: root,
            amount: amount,
            taken: 0,
            expiresAt: block.timestamp + CLAIM_WINDOW,
            swept: false
        });
        allocated += amount;
        emit RoundOpened(round, root, amount, block.timestamp + CLAIM_WINDOW);
    }

    /**
     * @notice Pays one holder their share of a round. Anyone may call it.
     *
     * The leaf is double-hashed, which is what OpenZeppelin's merkle-tree library
     * produces and what scripts/allowlist.ts already builds elsewhere in this
     * project. Matching that exactly matters more than it looks: a tree built
     * one way and verified the other rejects every proof, and the failure reads
     * as "your proof is wrong" to everybody.
     */
    function claim(
        uint256 round,
        address holder,
        uint256 amount,
        bytes32[] calldata proof
    ) external {
        Round storage one = rounds[round];
        if (one.root == bytes32(0)) revert NoSuchRound();
        if (claimed[round][holder]) revert AlreadyClaimed();

        bytes32 leaf = keccak256(bytes.concat(keccak256(abi.encode(holder, amount))));
        if (!MerkleProof.verify(proof, one.root, leaf)) revert BadProof();

        // A tree whose amounts sum to more than the round would let the last
        // holders in it take money belonging to another round. The tree is built
        // off chain and this is the only thing standing between a mistake there
        // and a round that cannot pay everybody it promised.
        if (one.taken + amount > one.amount) revert TooMuchClaimed();

        claimed[round][holder] = true;
        one.taken += amount;
        allocated -= amount;

        if (!card.transfer(holder, amount)) revert TokenTransferFailed();
        emit Claimed(round, holder, amount);
    }

    /**
     * @notice Returns what nobody took to the pool, once the round has expired.
     *
     * Anyone may call it: there is nothing to decide and nowhere for it to go
     * except back into the next round.
     */
    function sweep(uint256 round) external {
        Round storage one = rounds[round];
        if (one.root == bytes32(0)) revert NoSuchRound();
        if (one.swept) revert AlreadySwept();
        if (block.timestamp < one.expiresAt) revert NotExpiredYet(one.expiresAt);

        uint256 left = one.amount - one.taken;
        one.swept = true;
        allocated -= left;
        emit Swept(round, left);
    }

    function setPublisher(address publisher_) external onlyOwner {
        if (publisher_ == address(0)) revert ZeroAddress();
        emit PublisherChanged(publisher, publisher_);
        publisher = publisher_;
    }

    /// @notice What the next round would share out, if it opened now.
    function unallocated() external view returns (uint256) {
        return card.balanceOf(address(this)) - allocated;
    }
}
