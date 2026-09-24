// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

interface IRouter {
    function swapExactETHForTokensSupportingFeeOnTransferTokens(
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external payable;

    function getAmountsOut(uint256 amountIn, address[] calldata path)
        external
        view
        returns (uint256[] memory);

    function WETH() external view returns (address);
}

/**
 * @title The door to a board that costs money to play.
 * @notice Pay the fee, and the fee becomes two things: the game's revenue and
 *         the prize you are playing for.
 *
 * One board per deployment, the way PrizePot is one token per deployment. The
 * fee, the split and both destinations are fixed at construction and there is no
 * setter for any of them — so what this contract does with somebody's CRO is
 * decided once, in public, before anybody pays it.
 *
 * ── WHY IT SWAPS IN THE SAME TRANSACTION ─────────────────────────────────────
 *
 * The first shape of this held the CRO and let a nightly job buy the prize
 * token later. That is a contract sitting on players' money between the moment
 * they pay and the moment a job runs, and the job is a key on a server. Buying
 * inside `enter` means nothing is ever held: the fee arrives, half leaves for
 * the splitter, half comes back as prize token and goes straight to the pot, and
 * the balance is zero again before the call returns.
 *
 * It also means the entry cannot be quietly worth less than it looked. A player
 * paying ten CRO can see, in their own transaction, exactly what went into the
 * prize.
 *
 * ── WHAT IT DOES NOT DO ──────────────────────────────────────────────────────
 *
 * It does not know who won, does not hold the prize, and cannot pay anybody. The
 * pot is a PrizePot and that is where a winner is named — by the publisher key,
 * a day at a time, with the owner able to throw a proposal away. Folding the two
 * together would put "who won" and "where the money is" in one contract, and the
 * whole arrangement here is that those are separate.
 *
 * It also does not record that you played. A payment is a payment; the score is
 * refereed by replaying the match on the server. `Entered` is emitted so the
 * game can see who has paid for this week, which is a fact about the chain
 * rather than something a browser claims.
 */
contract BoardEntry is Ownable {
    /// @notice What one go costs, in wei. Fixed at construction.
    uint256 public immutable fee;

    /// @notice The share of the fee that buys the prize token, in basis points.
    uint256 public immutable prizeBps;

    /// @notice Where the game's half goes. contracts/Splitter.sol.
    address public immutable splitter;

    /// @notice The pot the prize token is bought into. contracts/PrizePot.sol.
    address public immutable pot;

    /// @notice The token the prize is paid in.
    IERC20 public immutable prize;

    /// @notice The exchange the prize token is bought through.
    IRouter public immutable router;

    /// @notice Wrapped CRO, the first hop. Read off the router rather than given.
    address public immutable weth;

    /**
     * @notice How far under the quote a swap may land before it reverts, in bps.
     *
     * Five per cent. Wider than the splitter's, and on purpose: this swaps a few
     * CRO at a time rather than hundreds, and a small trade against a thin pool
     * moves proportionally further. A revert here is a player who cannot play.
     */
    uint256 public constant SLIPPAGE_BPS = 500;

    /// @notice Paid, and what it bought.
    event Entered(address indexed player, uint256 paid, uint256 toSplitter, uint256 bought);

    error WrongFee(uint256 wanted, uint256 sent);
    error BoughtNothing();
    error TransferFailed(address to);
    error NotAnAddress();
    error NotASplit();

    constructor(
        uint256 fee_,
        uint256 prizeBps_,
        address splitter_,
        address pot_,
        IERC20 prize_,
        IRouter router_
    ) Ownable(msg.sender) {
        if (fee_ == 0) revert NotASplit();
        // A hundred per cent to the prize is a board that earns the game
        // nothing; zero is a board whose pot never grows. Both are almost
        // certainly a typo in a deploy script rather than a decision.
        if (prizeBps_ == 0 || prizeBps_ >= 10_000) revert NotASplit();
        if (
            splitter_ == address(0) ||
            pot_ == address(0) ||
            address(prize_) == address(0) ||
            address(router_) == address(0)
        ) revert NotAnAddress();

        fee = fee_;
        prizeBps = prizeBps_;
        splitter = splitter_;
        pot = pot_;
        prize = prize_;
        router = router_;

        // Asked of the router rather than passed in. A WCRO that is not the
        // router's own is a path that reverts on every call, and it would only
        // be found by somebody trying to play. Same reasoning as Splitter.
        weth = router_.WETH();
        if (weth == address(0)) revert NotAnAddress();
    }

    /**
     * @notice Pay to play this board once.
     *
     * Exact change. Taking more and refunding the difference is a second
     * transfer that can fail, on a path that has already spent the money — and
     * "you sent too much" is a thing a wallet can be told before it signs.
     */
    function enter() external payable {
        if (msg.value != fee) revert WrongFee(fee, msg.value);

        uint256 toPrize = (msg.value * prizeBps) / 10_000;
        uint256 toSplitter = msg.value - toPrize;

        address[] memory path = new address[](2);
        path[0] = weth;
        path[1] = address(prize);

        uint256 quoted = router.getAmountsOut(toPrize, path)[1];
        uint256 floor = (quoted * (10_000 - SLIPPAGE_BPS)) / 10_000;

        // Straight into the pot. Buying to this contract and forwarding after
        // would be a balance this contract holds, however briefly, and the point
        // of the shape is that it never holds one.
        //
        // Measured on the pot rather than trusted: the fee-on-transfer variant
        // returns nothing, and a token that takes a cut on the way in would make
        // any number the router reported a lie about what arrived.
        uint256 before = prize.balanceOf(pot);
        router.swapExactETHForTokensSupportingFeeOnTransferTokens{value: toPrize}(
            floor,
            path,
            pot,
            block.timestamp
        );
        uint256 bought = prize.balanceOf(pot) - before;
        if (bought == 0) revert BoughtNothing();

        // The game's half last, after the swap. A splitter that reverted would
        // otherwise leave the prize bought and the entry not counted, and the
        // player with neither.
        (bool sent, ) = splitter.call{value: toSplitter}("");
        if (!sent) revert TransferFailed(splitter);

        emit Entered(msg.sender, msg.value, toSplitter, bought);
    }

    /// @notice What one entry would buy right now, before slippage.
    function quote() external view returns (uint256) {
        address[] memory path = new address[](2);
        path[0] = weth;
        path[1] = address(prize);
        return router.getAmountsOut((fee * prizeBps) / 10_000, path)[1];
    }

    /**
     * @notice Send out CRO that belongs to nobody.
     *
     * There should never be any: `enter` spends everything it takes in the same
     * call. This is for CRO forced in with selfdestruct, which is the only way
     * a balance can appear here, and it is the same hatch MatchEscrow has for
     * the same reason — no delay and no announcement, because there is nothing
     * of anybody's to announce.
     */
    function sweep(address to) external onlyOwner {
        if (to == address(0)) revert NotAnAddress();
        uint256 stuck = address(this).balance;
        if (stuck == 0) return;
        (bool sent, ) = to.call{value: stuck}("");
        if (!sent) revert TransferFailed(to);
    }

    /// @notice Send out a token somebody put here by mistake. Entries hold none.
    function sweepToken(IERC20 token, address to) external onlyOwner {
        if (to == address(0)) revert NotAnAddress();
        uint256 stuck = token.balanceOf(address(this));
        if (stuck == 0) return;
        if (!token.transfer(to, stuck)) revert TransferFailed(to);
    }
}
