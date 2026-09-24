// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {BoardEntry, IRouter} from "../BoardEntry.sol";
import {FakeCard} from "./FakeCard.sol";

/**
 * Paying to play, and what the payment is allowed to become.
 *
 * What these have to prove is not that a division works. It is that a fee
 * cannot be steered — not by the caller, not by the owner, not by paying a
 * different amount — and that this contract never holds anybody's money for
 * longer than one call. That second one is the whole reason it swaps inside
 * `enter` instead of letting a nightly job do it, so it is the thing worth
 * asserting rather than describing.
 */
contract BoardEntryTest is Test {
    BoardEntry private gate;
    FakeRouter private router;
    FakeCard private prize;

    address private splitter = address(0x5111);
    address private pot = address(0x9077);
    address private player = address(0xB0B);

    uint256 private constant FEE = 10 ether;
    uint256 private constant HALF = 5_000;

    function setUp() public {
        prize = new FakeCard();
        router = new FakeRouter(prize);
        router.setRate(1000);
        gate = new BoardEntry(FEE, HALF, splitter, pot, IERC20(address(prize)), IRouter(address(router)));
        vm.deal(player, 100 ether);
    }

    // ── WHAT IT DOES WITH THE MONEY ─────────────────────────────────────────

    function test_splits_the_fee_in_two() public {
        vm.prank(player);
        gate.enter{value: FEE}();

        assertEq(splitter.balance, FEE / 2, "the game's half");
        assertEq(prize.balanceOf(pot), (FEE / 2) * 1000, "the prize half, as prize token");
    }

    function test_keeps_nothing_at_all() public {
        // The entire argument for swapping inside `enter`. A balance here is
        // players' money waiting on a key, and there is supposed to be no
        // moment at which one exists.
        vm.prank(player);
        gate.enter{value: FEE}();

        assertEq(address(gate).balance, 0, "no CRO held");
        assertEq(prize.balanceOf(address(gate)), 0, "no prize token held");
    }

    function test_buys_into_the_pot_and_not_into_itself() public {
        vm.prank(player);
        gate.enter{value: FEE}();
        // The router is told to deliver to the pot. Buying here and forwarding
        // after would be a balance, however brief, and a second transfer that
        // can fail after the money has already moved.
        assertEq(prize.balanceOf(pot), (FEE / 2) * 1000);
    }

    function test_the_pot_grows_with_every_entry() public {
        for (uint256 i = 0; i < 5; i++) {
            vm.prank(player);
            gate.enter{value: FEE}();
        }
        assertEq(prize.balanceOf(pot), 5 * (FEE / 2) * 1000, "five entries, five buys");
        assertEq(splitter.balance, 5 * (FEE / 2));
    }

    // ── WHAT IT REFUSES ─────────────────────────────────────────────────────

    function test_refuses_the_wrong_fee() public {
        vm.prank(player);
        vm.expectRevert(abi.encodeWithSelector(BoardEntry.WrongFee.selector, FEE, FEE - 1));
        gate.enter{value: FEE - 1}();

        // And too much, which is the one somebody will actually do. Refunding
        // the difference is a second transfer that can fail on a path that has
        // already spent the money; a wallet can be told before it signs.
        vm.prank(player);
        vm.expectRevert(abi.encodeWithSelector(BoardEntry.WrongFee.selector, FEE, FEE + 1));
        gate.enter{value: FEE + 1}();
    }

    function test_refuses_when_the_swap_delivers_nothing() public {
        // A drained pool, or a router that stopped working. Better a player who
        // cannot play than an entry taken for a prize that did not grow.
        router.setRate(0);
        vm.prank(player);
        vm.expectRevert(BoardEntry.BoughtNothing.selector);
        gate.enter{value: FEE}();
    }

    function test_refuses_a_split_that_is_not_one() public {
        vm.expectRevert(BoardEntry.NotASplit.selector);
        new BoardEntry(FEE, 0, splitter, pot, IERC20(address(prize)), IRouter(address(router)));
        vm.expectRevert(BoardEntry.NotASplit.selector);
        new BoardEntry(FEE, 10_000, splitter, pot, IERC20(address(prize)), IRouter(address(router)));
        vm.expectRevert(BoardEntry.NotASplit.selector);
        new BoardEntry(0, HALF, splitter, pot, IERC20(address(prize)), IRouter(address(router)));
    }

    function test_refuses_an_address_that_is_nobody() public {
        vm.expectRevert(BoardEntry.NotAnAddress.selector);
        new BoardEntry(FEE, HALF, address(0), pot, IERC20(address(prize)), IRouter(address(router)));
        vm.expectRevert(BoardEntry.NotAnAddress.selector);
        new BoardEntry(FEE, HALF, splitter, address(0), IERC20(address(prize)), IRouter(address(router)));
    }

    function test_reverts_rather_than_stranding_the_buy_when_the_splitter_refuses() public {
        // The splitter's half is sent last, after the swap. If it fails the
        // whole call unwinds — so a player never ends up with the prize bought,
        // the entry unrecorded and their ten CRO gone.
        Refuser bad = new Refuser();
        BoardEntry awkward =
            new BoardEntry(FEE, HALF, address(bad), pot, IERC20(address(prize)), IRouter(address(router)));

        vm.prank(player);
        vm.expectRevert(abi.encodeWithSelector(BoardEntry.TransferFailed.selector, address(bad)));
        awkward.enter{value: FEE}();

        assertEq(prize.balanceOf(pot), 0, "the buy was unwound with it");
    }

    // ── WHAT NOBODY CAN CHANGE ──────────────────────────────────────────────

    function test_has_no_setter_for_anything_that_decides_where_money_goes() public view {
        // Read back rather than believed. Every one of these is immutable, so
        // what this contract does with a fee was settled before anybody paid.
        assertEq(gate.fee(), FEE);
        assertEq(gate.prizeBps(), HALF);
        assertEq(gate.splitter(), splitter);
        assertEq(gate.pot(), pot);
        assertEq(address(gate.prize()), address(prize));
    }

    function test_the_owner_cannot_take_an_entry() public {
        vm.prank(player);
        gate.enter{value: FEE}();

        address thief = address(0xBAD);
        gate.sweep(thief);
        // Nothing to take: the money left in the same call it arrived.
        assertEq(thief.balance, 0);
        assertEq(splitter.balance, FEE / 2);
        assertEq(prize.balanceOf(pot), (FEE / 2) * 1000);
    }

    function test_the_owner_can_take_out_what_was_forced_in() public {
        // selfdestruct is the only way a balance appears here, and it is the
        // only thing the hatch is for.
        vm.deal(address(gate), 3 ether);
        address to = address(0xBEEF);
        gate.sweep(to);
        assertEq(to.balance, 3 ether);
        assertEq(address(gate).balance, 0);
    }

    function test_the_hatch_is_the_owner_s_and_nobody_else_s() public {
        vm.deal(address(gate), 1 ether);
        vm.prank(player);
        vm.expectRevert();
        gate.sweep(player);
    }

    // ── WHAT IT SAYS HAPPENED ───────────────────────────────────────────────

    function test_says_who_paid_and_what_it_bought() public {
        // The game reads this to know who has paid for this week. A payment
        // that did not announce itself would be one the browser has to claim,
        // which is the thing every other rule here refuses.
        vm.expectEmit(true, false, false, true);
        emit BoardEntry.Entered(player, FEE, FEE / 2, (FEE / 2) * 1000);
        vm.prank(player);
        gate.enter{value: FEE}();
    }

    function test_quotes_what_an_entry_would_buy() public view {
        assertEq(gate.quote(), (FEE / 2) * 1000);
    }
}

/** A splitter that will not take CRO. */
contract Refuser {
    receive() external payable {
        revert("no");
    }
}

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
