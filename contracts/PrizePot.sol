// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

import {Rescuable} from "./Rescuable.sol";

/**
 * The weekly prize, held where nobody can spend it.
 *
 * A fifth of every mint, every royalty and every ranked match arrives here
 * from Splitter.sol, as $CROCARD — the splitter buys it on the way. Each week
 * the pot is awarded to whoever posted the best verified score, and paid out.
 *
 * The prize is the token and not CRO, which is the maker's call: every stream in
 * this game is denominated in $CROCARD now, and a prize paid in something else
 * would be the one place that is not.
 *
 * ── THE ONE THING THAT CANNOT BE PUT ON THE CHAIN ────────────────────────────
 *
 * Who won. That is decided by replaying submitted matches on the server — see
 * lib/tournament.ts — and no contract can do it. So something off-chain has to
 * say a name, and saying a name needs a key.
 *
 * What this contract does about that is make the key worth almost nothing to
 * steal. The publisher may do exactly one thing: name the winner of a week that
 * has not been closed yet. It cannot withdraw, cannot change a week already
 * closed, cannot reach the balance, and cannot pay itself except by naming
 * itself — which costs it one week's pot, in public, once, on a contract anybody
 * is watching. The owner can then rotate it.
 *
 * The alternative is a wallet on a server that holds the pot and sends it. That
 * key is worth the whole balance and every future deposit. TCG looked at that
 * and refused it in writing: "the tournament wallet's key is not on any server,
 * deliberately".
 *
 * ── WHY ANYONE CAN CLAIM ─────────────────────────────────────────────────────
 *
 * `claim` pays the winner, not the caller. So the winner does not have to do
 * anything, does not need to know this contract exists, and does not need gas —
 * a cron pushes it the moment a week closes, and if the cron is down, anybody
 * can. A prize that has to be fetched is a prize somebody forgets to fetch.
 *
 * ── MORE THAN ONE BOARD ──────────────────────────────────────────────────────
 *
 * There is one pot and several leaderboards: beating the ordinary bot is one,
 * beating the Loaded Lions deck is another, and more can follow. Each board has
 * a share of the pot, in basis points, that the OWNER sets — not the publisher,
 * which only ever names winners. A key on a server that could also decide how
 * the money is divided is a key worth stealing.
 *
 * The shares do not have to add up to a hundred per cent and should not: what is
 * left unassigned stays in the pot and grows. Twenty-five and twenty-five leaves
 * half of it compounding, which is the maker's starting position.
 *
 * ── WHY EVERY BOARD CLOSES IN ONE TRANSACTION ────────────────────────────────
 *
 * Because otherwise the order decides the money. Close board A for 25% and the
 * pot is down to 75%; close board B for 25% and it takes a quarter of what is
 * left, which is 18.75%. Two equal shares, two unequal prizes, and nothing on
 * screen saying why.
 *
 * So `closeWeek` takes every board at once and divides them all from the same
 * reading of the pot. A board nobody won is left out of the call, and its share
 * simply stays where it is.
 *
 * ── WHY ONE WEEK CANNOT TAKE EVERYTHING ──────────────────────────────────────
 *
 * A fifth of every mint lands here and the mint is the busiest this game will
 * ever be. Without a ceiling the first week after a good mint hands one player
 * a double-digit percentage of the supply — for beating a bot once — and that
 * player is then the market. So a week pays at most `mostPerWeek`, and what is
 * over stays here and is the next week's pot.
 *
 * It rolls over rather than being refused, which matters: refusing would strand
 * it, and capping without rolling over would mean the pot only ever empties.
 * Every token that arrives is still paid out, just never all in one week.
 *
 * The ceiling is the owner's to move. A percentage of supply is the right rule
 * at a small market cap and the wrong one at a large one, and nobody can know
 * today which side of that this ends up on. It cannot be set to zero, because a
 * ceiling of nothing is a pot nobody can ever win out of.
 */
contract PrizePot is Rescuable {
    struct Prize {
        address winner;
        uint256 amount;
        bool paid;
    }

    /// @notice What the prize is paid in.
    IERC20 public immutable card;

    /// @notice The only address that may name a winner. Rotatable by the owner.
    address public publisher;

    /**
     * @notice Weeks that have been closed, keyed by week AND board.
     *
     * Two dimensions because one week now has several winners — one per board.
     * `prizes[week][board]`, where a board is a short name like "bot" or
     * "lions" and a week is "2026-W38".
     */
    mapping(bytes32 => mapping(bytes32 => Prize)) public prizes;

    /**
     * @notice What share of the pot each board plays for, in basis points.
     *
     * Zero for a board nobody has set, which means a board that does not exist
     * cannot be closed for anything. Set by the owner and never by the
     * publisher — see the note at the top about which key is worth stealing.
     */
    mapping(bytes32 => uint256) public shareOf;

    /// @notice Every board's share added up, so one check can stop it passing 100%.
    uint256 public sharedOut;

    /**
     * @notice What is spoken for and must not be handed out twice.
     *
     * Without this, closing a second week before the first is paid would award
     * the same CRO again — the balance is still sitting here, and nothing about
     * it says it already belongs to somebody.
     */
    uint256 public allocated;

    /**
     * @notice The most one week may pay. Anything over it rolls to the next.
     *
     * One percent of the billion $CROCARD there will ever be. Set in the
     * constructor rather than as a constant so it can be moved without a new
     * contract and a migration of the balance — see `setMostPerWeek`.
     */
    uint256 public mostPerWeek;

    /// @notice The default ceiling: 1% of a supply of one billion, at 18 decimals.
    uint256 public constant DEFAULT_MOST_PER_WEEK = 10_000_000 ether;

    event WeekClosed(bytes32 indexed week, bytes32 indexed board, address indexed winner, uint256 amount);
    event MostPerWeekChanged(uint256 from, uint256 to);
    event Paid(bytes32 indexed week, bytes32 indexed board, address indexed winner, uint256 amount);
    event PublisherChanged(address indexed from, address indexed to);
    event ShareChanged(bytes32 indexed board, uint256 from, uint256 to);

    error NotThePublisher();
    error WeekAlreadyClosed();
    error NoSuchWeek();
    error AlreadyPaid();
    error NothingToWin();
    error CeilingOfNothing();
    error NoSuchBoard(bytes32 board);
    error SharesOverAHundred(uint256 wanted);
    error NotTheSameNumberOfWinners();
    error NoBoards();

    error TokenTransferFailed();

    constructor(IERC20 card_, address publisher_) Ownable(msg.sender) {
        if (address(card_) == address(0) || publisher_ == address(0)) revert ZeroAddress();
        card = card_;
        publisher = publisher_;
        mostPerWeek = DEFAULT_MOST_PER_WEEK;
    }

    /**
     * Nothing to receive. Tokens arrive by being transferred here, which needs
     * no code — and that is the difference from the CRO version: a payable
     * receive() would now only let somebody strand CRO in a contract that has no
     * way to pay it out. The rescue hatch is what gets that back if it happens.
     */

    /**
     * @notice Names the winner of every board for a week and sets the prizes aside.
     *
     * ALL THE BOARDS AT ONCE, from one reading of the pot. Closing them one at a
     * time would make the order decide the money: a second board taking "25%"
     * after the first has taken its quarter is taking a quarter of what is left.
     *
     * A board nobody won is left out of the call. Its share stays in the pot and
     * is part of what the next week plays for.
     *
     * Each prize is that board's share of what has arrived and is not already
     * spoken for, capped at `mostPerWeek`. It is fixed here rather than read at
     * payout, so a deposit landing between closing and paying belongs to the next
     * week and not to a week that has already been decided.
     */
    function closeWeek(
        bytes32 week,
        bytes32[] calldata boards,
        address[] calldata winners
    ) external {
        if (msg.sender != publisher) revert NotThePublisher();
        if (boards.length != winners.length) revert NotTheSameNumberOfWinners();
        if (boards.length == 0) revert NoBoards();

        // One reading, before anything is taken out of it. This is the whole
        // reason the boards arrive together.
        uint256 pot = card.balanceOf(address(this)) - allocated;
        uint256 given;

        for (uint256 i = 0; i < boards.length; i++) {
            bytes32 board = boards[i];
            address winner = winners[i];

            if (winner == address(0)) revert ZeroAddress();
            // A board with no share is not a board. Without this, a typo in a
            // board name closes a week for nothing and the real board can never
            // be closed for that week again.
            if (shareOf[board] == 0) revert NoSuchBoard(board);
            // A week is closed once per board. Without it the publisher could
            // rename a winner it had already announced, which is the one thing
            // that would make the board worth less than the word of whoever
            // holds the key.
            //
            // It also covers the same board twice in ONE call, which is not
            // obvious and was nearly given its own check and its own error: the
            // write below happens inside this loop, so the second appearance
            // reads a winner that the first appearance already set. A test asks
            // for that case by name, because the thing keeping it safe is an
            // assignment eight lines down rather than anything that looks like a
            // guard.
            if (prizes[week][board].winner != address(0)) revert WeekAlreadyClosed();

            uint256 amount = (pot * shareOf[board]) / 10_000;
            if (amount > mostPerWeek) amount = mostPerWeek;
            if (amount == 0) revert NothingToWin();

            prizes[week][board] = Prize({winner: winner, amount: amount, paid: false});
            given += amount;
            emit WeekClosed(week, board, winner, amount);
        }

        allocated += given;
    }

    /**
     * @notice Sets what share of the pot a board plays for, in basis points.
     *
     * The owner's to decide and nobody else's. Setting it to zero retires a
     * board: it can no longer be closed, and what it used to play for goes back
     * into what the pot holds for everybody.
     *
     * The total may not pass a hundred per cent, and is not meant to reach it.
     * What is left unassigned is what the pot keeps and grows on.
     */
    function setShare(bytes32 board, uint256 bps) external onlyOwner {
        uint256 was = shareOf[board];
        uint256 wanted = sharedOut - was + bps;
        if (wanted > 10_000) revert SharesOverAHundred(wanted);

        emit ShareChanged(board, was, bps);
        shareOf[board] = bps;
        sharedOut = wanted;
    }

    /**
     * @notice Pays a closed week to its winner. Anyone may call this.
     *
     * It pays the winner and not the caller, so there is nothing to gain by
     * being the one to call it and nothing to lose by being slow.
     */
    function claim(bytes32 week, bytes32 board) external {
        Prize storage prize = prizes[week][board];
        if (prize.winner == address(0)) revert NoSuchWeek();
        if (prize.paid) revert AlreadyPaid();

        // Effects before interactions. A winner that calls back in finds a week
        // already marked paid and an allocation already released.
        prize.paid = true;
        uint256 amount = prize.amount;
        allocated -= amount;

        if (!card.transfer(prize.winner, amount)) revert TokenTransferFailed();
        emit Paid(week, board, prize.winner, amount);
    }

    /**
     * @notice Replaces the publisher.
     *
     * The answer to a leaked key, and the reason the owner should be a wallet
     * that never touches a server. It cannot undo a week already closed — that
     * is deliberate, because a winner who has been told they won should not have
     * it taken back by a key rotation.
     */
    function setPublisher(address publisher_) external onlyOwner {
        if (publisher_ == address(0)) revert ZeroAddress();
        emit PublisherChanged(publisher, publisher_);
        publisher = publisher_;
    }

    /**
     * @notice Moves the ceiling on what one week may pay.
     *
     * One percent of supply is the right rule while the token is small and the
     * wrong one if it is ever large, and this is the maker's judgement to make
     * later rather than a number welded in today.
     *
     * It does not touch a week already closed. A winner who has been told what
     * they won keeps it, the same way a key rotation cannot take it back.
     */
    function setMostPerWeek(uint256 most) external onlyOwner {
        // Zero would not be a small ceiling, it would be a pot nobody can ever
        // win out of: closeWeek would revert with NothingToWin every week while
        // the balance kept growing, and it would look like a bug in the cron.
        if (most == 0) revert CeilingOfNothing();
        emit MostPerWeekChanged(mostPerWeek, most);
        mostPerWeek = most;
    }

    /// @notice What has arrived and is spoken for by nobody.
    function unallocated() external view returns (uint256) {
        return card.balanceOf(address(this)) - allocated;
    }

    /**
     * @notice What one board would pay, if the week closed now.
     *
     * Not the same as `unallocated` and not the same for every board, which is
     * exactly when somebody looking at the balance would guess wrong.
     */
    function nextPrize(bytes32 board) external view returns (uint256) {
        uint256 free = card.balanceOf(address(this)) - allocated;
        uint256 amount = (free * shareOf[board]) / 10_000;
        return amount > mostPerWeek ? mostPerWeek : amount;
    }
}
