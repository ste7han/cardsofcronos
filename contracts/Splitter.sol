// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

import {Rescuable} from "./Rescuable.sol";

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
}

/**
 * Every way money enters this game, turned into $CROCARD and divided.
 *
 * CRO arrives — mint proceeds pushed out of the NFT contract, a royalty paid by
 * a marketplace that read ERC2981, a rake from a ranked match. All of it buys
 * $CROCARD, and the tokens are what gets split: half to the people holding it, a
 * quarter burned, a quarter into the weekly prize pot.
 *
 * The maker's call, and it changes what the split means. An earlier version
 * divided the CRO itself and only the burn leg ever touched the token; this puts
 * every stream through the market, so the whole of it is buy pressure and every
 * destination is paid in the thing the game is about.
 *
 * ── WHY IT NEEDS NO KEY ──────────────────────────────────────────────────────
 *
 * `release` is callable by anybody. The three destinations are immutable and set
 * once at construction, the three shares are constants, and the path is fixed —
 * so there is no input to this function and no choice in what it does. A stranger
 * calling it does exactly what the owner calling it would.
 *
 * That is what makes it safe to automate. The alternative shape — a wallet on a
 * server that reads balances and sends transactions — automates the same job and
 * puts everything this will ever hold behind one secret.
 *
 * ── WHAT THE CAP IS FOR ──────────────────────────────────────────────────────
 *
 * MOST_PER_RELEASE bounds one swap. The pool this trades against held about
 * 27,800 CRO when this was written, so 100 CRO moves it a third of a per cent
 * and 5,000 moves it fifteen. Capping the swap means a release that has built up
 * is taken in bites rather than in one bad trade, and it bounds what a sandwich
 * around any single call can be worth.
 *
 * It does NOT make sandwiching impossible and nothing here pretends to: the
 * minimum-out is computed from reserves at execution time, and an attacker who
 * moved those reserves first has already moved what it compares against. What it
 * stops is the other thing — a pool that has been drained or a router that has
 * gone wrong handing back almost nothing while the transaction succeeds.
 */
contract Splitter is Rescuable {
    /// Basis points, out of 10_000. Constants: this split has no admin.
    uint256 public constant HOLDERS_BPS = 5_000;
    uint256 public constant BURN_BPS = 2_500;
    uint256 public constant POT_BPS = 2_500;

    /// @notice The most CRO one call will swap. Call it again for the rest.
    uint256 public constant MOST_PER_RELEASE = 500 ether;

    /// @notice How far under the quote a swap may land before it reverts, in bps.
    uint256 public constant SLIPPAGE_BPS = 300;

    IRouter public immutable router;
    /// @notice Wrapped CRO, the first hop. Read off the router rather than given.
    address public immutable weth;
    IERC20 public immutable card;

    /// @notice Where the holders' half goes to be claimed from.
    address public immutable holders;
    /// @notice Where the burned quarter goes. A dead address, not a wallet.
    address public immutable burner;
    /// @notice The weekly prize pot.
    address public immutable pot;

    event Released(uint256 croSpent, uint256 toHolders, uint256 burned, uint256 toPot);

    error NothingToRelease();
    error TransferFailed(address to);
    error BoughtNothing();

    constructor(
        IRouter router_,
        IERC20 card_,
        address holders_,
        address burner_,
        address pot_
    ) Ownable(msg.sender) {
        // A zero here is money sent to nowhere on every release, forever.
        if (
            address(router_) == address(0) ||
            address(card_) == address(0) ||
            holders_ == address(0) ||
            burner_ == address(0) ||
            pot_ == address(0)
        ) revert ZeroAddress();

        router = router_;
        card = card_;
        holders = holders_;
        burner = burner_;
        pot = pot_;

        // Asked rather than passed in. A wrapped-CRO address that does not match
        // the router's own is a path that reverts on every call, and it would
        // not be found until the first release.
        weth = _wethOf(router_);
    }

    function _wethOf(IRouter router_) private view returns (address found) {
        (bool ok, bytes memory answer) = address(router_).staticcall(
            abi.encodeWithSignature("WETH()")
        );
        if (!ok || answer.length != 32) revert ZeroAddress();
        found = abi.decode(answer, (address));
        if (found == address(0)) revert ZeroAddress();
    }

    /// @notice Takes whatever has arrived, from anywhere.
    receive() external payable {}

    /**
     * @notice Buys $CROCARD with what has arrived and sends it on. Anyone may call.
     *
     * The remainder goes to the pot rather than being left behind. Three shares
     * of an odd number of units leave up to two stranded, and "up to two, every
     * time, forever" is a balance that only ever grows and that nothing can pay
     * out.
     */
    function release() external {
        uint256 balance = address(this).balance;
        if (balance == 0) revert NothingToRelease();
        uint256 spend = balance > MOST_PER_RELEASE ? MOST_PER_RELEASE : balance;

        address[] memory path = new address[](2);
        path[0] = weth;
        path[1] = address(card);

        uint256 quoted = router.getAmountsOut(spend, path)[1];
        uint256 floor = (quoted * (10_000 - SLIPPAGE_BPS)) / 10_000;

        // Measured rather than trusted. The fee-on-transfer variant returns
        // nothing, and a token that takes a cut on the way in would make any
        // number the router reported a lie about what arrived.
        uint256 before = card.balanceOf(address(this));
        router.swapExactETHForTokensSupportingFeeOnTransferTokens{value: spend}(
            floor,
            path,
            address(this),
            block.timestamp
        );
        uint256 bought = card.balanceOf(address(this)) - before;
        if (bought == 0) revert BoughtNothing();

        uint256 toHolders = (bought * HOLDERS_BPS) / 10_000;
        uint256 burned = (bought * BURN_BPS) / 10_000;
        uint256 toPot = bought - toHolders - burned;

        _send(holders, toHolders);
        _send(burner, burned);
        _send(pot, toPot);

        emit Released(spend, toHolders, burned, toPot);
    }

    function _send(address to, uint256 amount) private {
        if (amount == 0) return;
        if (!card.transfer(to, amount)) revert TransferFailed(to);
    }

    /// @notice What one call would swap right now.
    function nextRelease() external view returns (uint256) {
        uint256 balance = address(this).balance;
        return balance > MOST_PER_RELEASE ? MOST_PER_RELEASE : balance;
    }
}
