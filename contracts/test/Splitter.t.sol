// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {Rescuable} from "../Rescuable.sol";
import {FakeCard} from "./FakeCard.sol";
import {IRouter, Splitter} from "../Splitter.sol";

/**
 * The one split there is, and the reason it needs nobody's permission.
 *
 * What these have to prove is not that division works. It is that `release`
 * cannot be steered — not by who calls it, not by arguments (it has none), not
 * by the owner (there is none for this) — and that what it hands out is what it
 * actually received rather than what a router said it would. That is the whole
 * safety argument for putting it on a timer.
 */
contract SplitterTest is Test {
    Splitter private splitter;
    FakeRouter private router;
    FakeCard private card;

    address private holders = address(0xA1);
    address private burner = address(0xB2);
    address private pot = address(0xC3);

    function setUp() public {
        card = new FakeCard();
        router = new FakeRouter(card);
        // 22,800 CROCARD per CRO, roughly what the real pool paid when this was
        // written.
        router.setRate(22_800);
        splitter = new Splitter(IRouter(address(router)), IERC20(address(card)), holders, burner, pot);
    }

    function test_buysAndDividesFiftyTwentyFiveTwentyFive() public {
        vm.deal(address(splitter), 100 ether);
        splitter.release();

        // 100 CRO bought 2,280,000 tokens.
        assertEq(card.balanceOf(holders), 1_140_000 ether, "half to the people holding it");
        assertEq(card.balanceOf(burner), 570_000 ether, "a quarter burned");
        assertEq(card.balanceOf(pot), 570_000 ether, "a quarter to the weekly pot");
        assertEq(address(splitter).balance, 0, "and the CRO is spent");
        assertEq(card.balanceOf(address(splitter)), 0, "and nothing kept back");
    }

    /** A stranger gets the same result as anybody else, which is the point. */
    function test_anybodyMayCallIt() public {
        vm.deal(address(splitter), 10 ether);
        vm.prank(address(0xDEAD));
        splitter.release();
        assertEq(card.balanceOf(holders), 114_000 ether);
    }

    /**
     * One call takes a bite, not the whole balance.
     *
     * The pool is small enough that a release which has built up would be a bad
     * trade in one go. Capping it means the rest waits for the next call, and
     * anybody can make that call.
     */
    function test_oneCallSwapsAtMostTheCap() public {
        vm.deal(address(splitter), 1_300 ether);
        assertEq(splitter.nextRelease(), 500 ether);

        splitter.release();
        assertEq(address(splitter).balance, 800 ether, "the rest is still here");

        splitter.release();
        splitter.release();
        assertEq(address(splitter).balance, 0, "three calls finish it");
    }

    /** What arrived, not what the router claimed. */
    function test_countsWhatActuallyArrived() public {
        // A token that takes ten per cent on transfer. The router would report
        // the full amount; the contract measures its own balance instead.
        card.setFee(1_000);
        vm.deal(address(splitter), 100 ether);
        splitter.release();

        uint256 handedOut =
            card.balanceOf(holders) + card.balanceOf(burner) + card.balanceOf(pot);
        assertGt(handedOut, 0, "something arrived");
        assertEq(card.balanceOf(address(splitter)), 0, "and all of it went on");
    }

    /** Nothing is left behind, however awkward the number. */
    function testFuzz_everythingIsSentSomewhere(uint96 amount) public {
        vm.assume(amount > 1e6 && amount <= 500 ether);
        vm.deal(address(splitter), amount);
        splitter.release();

        assertEq(card.balanceOf(address(splitter)), 0, "no dust accumulates");
        assertEq(
            card.balanceOf(holders) + card.balanceOf(burner) + card.balanceOf(pot),
            uint256(amount) * 22_800,
            "every token arrived somewhere"
        );
    }

    function test_theRemainderIsNotStranded() public {
        // Three units is the smallest amount that cannot divide cleanly.
        router.setRate(1);
        vm.deal(address(splitter), 3);
        splitter.release();
        assertEq(card.balanceOf(holders), 1);
        assertEq(card.balanceOf(burner), 0);
        assertEq(card.balanceOf(pot), 2, "the odd units land in the pot");
        assertEq(card.balanceOf(address(splitter)), 0);
    }

    function test_releasingNothingReverts() public {
        vm.expectRevert(Splitter.NothingToRelease.selector);
        splitter.release();
    }

    /** A pool that hands back nothing is a revert, not a silent success. */
    function test_aSwapThatBuysNothingReverts() public {
        router.setRate(0);
        vm.deal(address(splitter), 10 ether);
        vm.expectRevert();
        splitter.release();
    }

    /** A zero destination is money burned by accident, on every release. */
    function test_refusesAZeroAnything() public {
        vm.expectRevert(Rescuable.ZeroAddress.selector);
        new Splitter(IRouter(address(router)), IERC20(address(card)), address(0), burner, pot);
        vm.expectRevert(Rescuable.ZeroAddress.selector);
        new Splitter(IRouter(address(router)), IERC20(address(card)), holders, address(0), pot);
        vm.expectRevert(Rescuable.ZeroAddress.selector);
        new Splitter(IRouter(address(router)), IERC20(address(card)), holders, burner, address(0));
        vm.expectRevert(Rescuable.ZeroAddress.selector);
        new Splitter(IRouter(address(0)), IERC20(address(card)), holders, burner, pot);
    }

    /** It takes CRO from anywhere, because a marketplace does not announce itself. */
    function test_acceptsAPlainTransfer() public {
        address sender = address(0xF00D);
        vm.deal(sender, 1 ether);
        vm.prank(sender);
        (bool sent, ) = address(splitter).call{value: 1 ether}("");
        assertTrue(sent, "a royalty that reverts is a sale that reverts");
        assertEq(address(splitter).balance, 1 ether);
    }

    /** The shares are constants. Nobody can move them, including the deployer. */
    function test_theSplitHasNoAdmin() public view {
        assertEq(splitter.HOLDERS_BPS(), 5_000);
        assertEq(splitter.BURN_BPS(), 2_500);
        assertEq(splitter.POT_BPS(), 2_500);
        assertEq(
            splitter.HOLDERS_BPS() + splitter.BURN_BPS() + splitter.POT_BPS(),
            10_000,
            "a split that does not add up leaves a remainder with nowhere to go"
        );
    }

    /** The path is read off the router, so it cannot disagree with it. */
    function test_takesTheWrappedTokenFromTheRouter() public view {
        assertEq(splitter.weth(), router.WETH());
    }
}

// ── stand-ins ───────────────────────────────────────────────────────────────

/** A router that pays a fixed rate, so the arithmetic above is knowable. */
contract FakeRouter {
    FakeCard private immutable card;
    uint256 private rate;

    constructor(FakeCard card_) {
        card = card_;
    }

    function setRate(uint256 rate_) external {
        rate = rate_;
    }

    function WETH() external pure returns (address) {
        return address(0x1111);
    }

    function getAmountsOut(uint256 amountIn, address[] calldata)
        external
        view
        returns (uint256[] memory out)
    {
        out = new uint256[](2);
        out[0] = amountIn;
        out[1] = amountIn * rate;
    }

    function swapExactETHForTokensSupportingFeeOnTransferTokens(
        uint256,
        address[] calldata,
        address to,
        uint256
    ) external payable {
        card.mint(to, msg.value * rate);
    }
}
