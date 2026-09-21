// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

import {Rescuable} from "./Rescuable.sol";

/**
 * What two players put up on a ranked match, held where neither can take it.
 *
 * A friendly match touches nothing and never comes here. A ranked one is two
 * equal deposits of CRO: whoever opens the seat sets the amount, whoever sits
 * down matches it exactly, and the pot goes to the winner less a cut that goes
 * to Splitter.sol — which buys $CROCARD with it and divides it the same three
 * ways as everything else this game earns.
 *
 * ── THE ONE THING THAT CANNOT BE PUT ON THE CHAIN ────────────────────────────
 *
 * Who won. A match is a seed and a list of moves, replayed on the server, and
 * no contract can do that. So something off-chain has to say a name, and saying
 * a name needs a key — the same problem PrizePot.sol has, answered the same way.
 *
 * The publisher may do exactly one thing: name the winner of a match that has
 * two deposits and has not been settled. It cannot withdraw, cannot re-settle,
 * cannot reach a balance, and cannot pay itself except by naming itself — which
 * costs it one pot, in public, once, on a contract anybody is watching. The
 * owner can then rotate it.
 *
 * ── A CLOCK THAT RUNS OUT IS A LOSS ──────────────────────────────────────────
 *
 * Correspondence is a day a turn. Letting the clock run out is losing, and the
 * server settles it as one — that is a rule about the game and it lives there,
 * not here. This contract cannot tell a forfeit from a defeat and does not try.
 *
 * What it does have is a deadline of its own, and it is for a different problem:
 * a publisher that has stopped answering. After it passes, either player can
 * take their own deposit back and neither can take the other's. That is not a
 * draw anybody plays for — it is the exit from a settlement that never came.
 *
 * ── WHY ANYONE CAN CLAIM, AND WHY CLAIM IS NOT PART OF SETTLE ────────────────
 *
 * `settle` records the winner and moves nothing. `claim` pays the winner, not
 * the caller. A push payment inside settle would let a receiver that reverts on
 * purpose lock the publisher out of settling anything — and the publisher is
 * one key answering for every match at once.
 */
contract MatchEscrow is Ownable, Rescuable {
    /**
     * @notice $CROCARD. What the winner holds decides the cut.
     *
     * The same ladder as the rest of the game — data/holder-tiers.ts — and the
     * same four rungs the collection discounts a mint on. Holding is meant to
     * mean you keep more of what you win, and this is where that is true.
     */
    IERC20 public discountToken = IERC20(0xECf3361441512c1e9F6A6e8734D86614D8e795BC);

    /// @notice The rungs, in whole tokens times 1e18.
    uint256 public constant BAGHOLDER_AT = 100_000e18;
    uint256 public constant HOLDER_AT = 1_000_000e18;
    uint256 public constant WHALE_AT = 10_000_000e18;

    /**
     * @notice What is taken from a pot, in basis points, per rung.
     *
     * 25% down to 5%, which is data/holder-tiers.ts. Constants with no setter:
     * a cut somebody can be moved onto after they staked is not a deal.
     */
    uint256 public constant RETAIL_BPS = 2_500;
    uint256 public constant BAGHOLDER_BPS = 1_500;
    uint256 public constant HOLDER_BPS = 1_000;
    uint256 public constant WHALE_BPS = 500;

    /// @notice Where the cut goes. It buys $CROCARD and divides it 50/30/20.
    address payable public immutable splitter;

    /// @notice The key that may name a winner, and do nothing else.
    address public publisher;

    /**
     * @notice How long after a match fills before either side may walk away.
     *
     * Not a game rule. It is the exit from a publisher that stopped answering,
     * and it is long enough that it never competes with an ordinary settlement:
     * a correspondence match is a day a turn over ten turns.
     */
    uint256 public constant ABANDON_AFTER = 30 days;

    enum State {
        None,
        Open,
        Full,
        Settled
    }

    struct Wager {
        address opener;
        address joiner;
        /// @notice CRO per side. The pot is twice this.
        uint256 stake;
        /// @notice When it filled, which is when ABANDON_AFTER starts counting.
        uint256 filledAt;
        State state;
        /// @notice Set by settle. Zero until then.
        address winner;
        /// @notice So a pot cannot be taken twice.
        bool paid;
        /// @notice Which sides have taken a deposit back after abandonment.
        mapping(address => bool) walked;
    }

    mapping(bytes32 => Wager) private wagers;

    error NotThePublisher();
    error AlreadyExists();
    error NoSuchMatch();
    error NotOpen();
    error NotFull();
    error WrongStake(uint256 wanted, uint256 sent);
    error NothingStaked();
    error CannotPlayYourself();
    error NotSettledYet();
    error NotAPlayer();
    error NotYetAbandoned(uint256 until);
    error AlreadyPaid();
    error NotTheWinner();
    error SendFailed();

    event Opened(bytes32 indexed id, address indexed opener, uint256 stake);
    event Joined(bytes32 indexed id, address indexed joiner, uint256 stake);
    event Cancelled(bytes32 indexed id, address indexed opener, uint256 stake);
    event Settled(bytes32 indexed id, address indexed winner, uint256 pot, uint256 cut);
    event Claimed(bytes32 indexed id, address indexed winner, uint256 paid);
    event WalkedAway(bytes32 indexed id, address indexed player, uint256 stake);
    event PublisherChanged(address indexed from, address indexed to);

    constructor(address payable splitter_, address publisher_) Ownable(msg.sender) {
        require(splitter_ != address(0), "no splitter");
        require(publisher_ != address(0), "no publisher");
        splitter = splitter_;
        publisher = publisher_;
    }

    // ------------------------------------------------------------- the seats

    /**
     * @notice Puts up a stake and opens a seat. The value sent is the stake.
     * @param id The match, as the server knows it. Opaque here.
     */
    function open(bytes32 id) external payable {
        if (msg.value == 0) revert NothingStaked();
        Wager storage wager = wagers[id];
        if (wager.state != State.None) revert AlreadyExists();

        wager.opener = msg.sender;
        wager.stake = msg.value;
        wager.state = State.Open;
        emit Opened(id, msg.sender, msg.value);
    }

    /**
     * @notice Matches the stake and fills the seat.
     *
     * Exactly the stake, not at least it. Overpaying would have to be refunded
     * and a refund inside a join is a second way for this to fail — and the
     * amount is on the screen in front of whoever is pressing the button.
     */
    function join(bytes32 id) external payable {
        Wager storage wager = wagers[id];
        if (wager.state != State.Open) revert NotOpen();
        if (msg.value != wager.stake) revert WrongStake(wager.stake, msg.value);
        // Both seats being one person would make settling meaningless and the
        // cut a pure loss to them.
        if (msg.sender == wager.opener) revert CannotPlayYourself();

        wager.joiner = msg.sender;
        wager.filledAt = block.timestamp;
        wager.state = State.Full;
        emit Joined(id, msg.sender, msg.value);
    }

    /**
     * @notice Takes back a stake from a seat nobody sat down at.
     *
     * Only the opener, and only while it is still open. Once somebody has
     * matched it there is a match, and a match ends by being settled or by
     * being abandoned.
     */
    function cancel(bytes32 id) external {
        Wager storage wager = wagers[id];
        if (wager.state != State.Open) revert NotOpen();
        if (msg.sender != wager.opener) revert NotAPlayer();

        uint256 stake = wager.stake;
        wager.state = State.Settled;
        wager.paid = true;
        emit Cancelled(id, msg.sender, stake);
        pay(msg.sender, stake);
    }

    // ------------------------------------------------------------ the result

    /**
     * @notice Names the winner of a full match. The publisher, and nothing else.
     *
     * Moves nothing. See the note at the top for why paying is a separate call.
     */
    function settle(bytes32 id, address winner) external {
        if (msg.sender != publisher) revert NotThePublisher();
        Wager storage wager = wagers[id];
        if (wager.state != State.Full) revert NotFull();
        if (winner != wager.opener && winner != wager.joiner) revert NotAPlayer();

        wager.winner = winner;
        wager.state = State.Settled;

        uint256 pot = wager.stake * 2;
        emit Settled(id, winner, pot, (pot * cutFor(winner)) / 10_000);
    }

    /**
     * @notice Pays a settled pot to its winner, less the cut.
     *
     * Anybody may call it and it always pays the winner, so a winner who has
     * lost interest still gets paid and a stranger can only spend their own gas.
     *
     * The cut is worked out HERE and not at settle, deliberately: it depends on
     * what the winner holds, and holding more between the two should count. The
     * amount in the Settled event is what it would have been at that moment and
     * is there to be read, not to be relied on.
     */
    function claim(bytes32 id) external {
        Wager storage wager = wagers[id];
        if (wager.state != State.Settled) revert NotSettledYet();
        if (wager.winner == address(0)) revert NotTheWinner();
        if (wager.paid) revert AlreadyPaid();

        wager.paid = true;

        uint256 pot = wager.stake * 2;
        uint256 cut = (pot * cutFor(wager.winner)) / 10_000;
        emit Claimed(id, wager.winner, pot - cut);

        // The cut first. A winner that cannot receive must not also cost the
        // game its cut, and the splitter is a contract that accepts CRO.
        if (cut > 0) pay(splitter, cut);
        pay(wager.winner, pot - cut);
    }

    /**
     * @notice Takes your own deposit back from a match nobody ever settled.
     *
     * Each side takes its own and neither can take the other's, so this cannot
     * be a way to win. It exists for one case: a publisher that stopped
     * answering, thirty days ago.
     */
    function walkAway(bytes32 id) external {
        Wager storage wager = wagers[id];
        if (wager.state != State.Full) revert NotFull();
        if (msg.sender != wager.opener && msg.sender != wager.joiner) revert NotAPlayer();

        uint256 until = wager.filledAt + ABANDON_AFTER;
        if (block.timestamp < until) revert NotYetAbandoned(until);
        if (wager.walked[msg.sender]) revert AlreadyPaid();

        wager.walked[msg.sender] = true;
        uint256 stake = wager.stake;
        emit WalkedAway(id, msg.sender, stake);
        pay(msg.sender, stake);
    }

    // ------------------------------------------------------------------ read

    /// @notice What comes off a pot for this address, in basis points.
    function cutFor(address winner) public view returns (uint256) {
        uint256 held = discountToken.balanceOf(winner);
        if (held >= WHALE_AT) return WHALE_BPS;
        if (held >= HOLDER_AT) return HOLDER_BPS;
        if (held >= BAGHOLDER_AT) return BAGHOLDER_BPS;
        return RETAIL_BPS;
    }

    /// @notice A match, as much of it as anybody needs to see.
    function wagerOf(bytes32 id)
        external
        view
        returns (
            address opener,
            address joiner,
            uint256 stake,
            uint256 filledAt,
            State state,
            address winner,
            bool paid
        )
    {
        Wager storage wager = wagers[id];
        return (
            wager.opener,
            wager.joiner,
            wager.stake,
            wager.filledAt,
            wager.state,
            wager.winner,
            wager.paid
        );
    }

    // ----------------------------------------------------------------- admin

    function setPublisher(address publisher_) external onlyOwner {
        require(publisher_ != address(0), "no publisher");
        emit PublisherChanged(publisher, publisher_);
        publisher = publisher_;
    }

    /**
     * @notice Which token the cut ladder reads.
     *
     * Owner only, and it is here for the same reason the collection has one: a
     * token contract can be replaced and a ladder pointed at a dead address
     * would put everybody on the retail rate.
     */
    function setDiscountToken(IERC20 token) external onlyOwner {
        discountToken = token;
    }

    function pay(address to, uint256 amount) private {
        (bool sent, ) = payable(to).call{value: amount}("");
        if (!sent) revert SendFailed();
    }
}
