// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {CardsOfCronosSetOne} from "../CardsOfCronosSetOne.sol";

/**
 * The contract, against the allowlist it will actually be deployed with.
 *
 * `data/allowlist.json` is read off disk rather than reproduced here. That is
 * the whole point: the leaf shape in the contract was written by hand to match
 * what scripts/allowlist.ts produces, and "written to match" is the kind of
 * claim this project does not accept anywhere else. test/allowlist.test.ts
 * checks the two expressions agree; this checks that the contract accepts a
 * proof the script actually made, for a wallet that actually holds cards.
 */
contract AllowlistTest is Test {
    CardsOfCronosSetOne private nft;
    Fake private crocard;

    bytes32 private root;
    string private allowlist;

    function setUp() public {
        allowlist = vm.readFile("data/allowlist.json");
        root = vm.parseJsonBytes32(allowlist, ".root");

        nft = new CardsOfCronosSetOne("Cards of Cronos Set 01", "COC1", 2000, "ipfs://x/", root);
        crocard = new Fake();
        nft.setDiscountToken(IERC20(address(crocard)));
        nft.setClaimsOpen(true);
    }

    // --- reading the real file -------------------------------------------

    function claimAt(uint256 i) internal view returns (address who, uint256 owed, bytes32[] memory proof) {
        string memory at = string.concat(".claims[", vm.toString(i), "]");
        who = vm.parseJsonAddress(allowlist, string.concat(at, ".address"));
        owed = vm.parseJsonUint(allowlist, string.concat(at, ".quantity"));
        proof = vm.parseJsonBytes32Array(allowlist, string.concat(at, ".proof"));
    }

    /** The first claim owed between two and MAX_MINT_PER_TX, so a whole
     *  allowance fits in one transaction. The largest holder in the real file is
     *  owed 63 and the cap is 50, which is a fact worth having a test of its own
     *  — see test_aBigHolderHasToClaimInParts — rather than one that quietly
     *  breaks every other test in this file. */
    function smallClaim() internal view returns (address who, uint256 owed, bytes32[] memory proof) {
        uint256 n = vm.parseJsonUint(allowlist, ".addresses");
        for (uint256 i = 0; i < n; i++) {
            (who, owed, proof) = claimAt(i);
            if (owed >= 2 && owed <= nft.MAX_MINT_PER_TX()) return (who, owed, proof);
        }
        revert("no claim in the file is between two and the per-transaction cap");
    }

    function test_theFileHasHoldersInIt() public view {
        // If this file is ever empty the tests below would all pass by doing
        // nothing, which is the shape of failure this repository has been bitten
        // by before.
        uint256 n = vm.parseJsonUint(allowlist, ".addresses");
        assertGt(n, 10, "the allowlist should have real holders in it");
        assertEq(nft.allowlistRoot(), root);
    }

    function test_aRealProofIsAccepted() public {
        // The one that matters. Everything else in this file is about what the
        // contract refuses; this is the only test that says the free mints can
        // be taken at all.
        (address who, uint256 owed, bytes32[] memory proof) = claimAt(0);

        vm.prank(who);
        nft.claim(owed, proof, 1);

        assertEq(nft.balanceOf(who), 1);
        assertEq(nft.claimed(who), 1);
        assertEq(nft.ownerOf(1), who);
    }

    function test_everyProofInTheFileIsAccepted() public {
        // Not a sample. A holder whose proof does not verify is a person who was
        // promised a mint and cannot take it, and there is no reason to find
        // that out one wallet at a time.
        uint256 n = vm.parseJsonUint(allowlist, ".addresses");
        for (uint256 i = 0; i < n; i++) {
            (address who, uint256 owed, bytes32[] memory proof) = claimAt(i);
            vm.prank(who);
            nft.claim(owed, proof, 1);
            assertEq(nft.claimed(who), 1);
        }
    }

    // --- what it has to refuse -------------------------------------------

    function test_claimingMoreThanTheAllowance() public {
        (address who, uint256 owed, bytes32[] memory proof) = smallClaim();
        vm.prank(who);
        vm.expectRevert(CardsOfCronosSetOne.AlreadyClaimed.selector);
        nft.claim(owed, proof, owed + 1);
    }

    function test_aBigHolderHasToClaimInParts() public {
        // The largest holder in the real allowlist is owed 63 and
        // MAX_MINT_PER_TX is 50, so their allowance does not fit in one
        // transaction. That is intended — the cap is what stops one call from
        // minting a thousand — but it is only fair because claiming in parts
        // works, and nothing said so until this test did.
        (address who, uint256 owed, bytes32[] memory proof) = claimAt(0);
        uint256 cap = nft.MAX_MINT_PER_TX();
        vm.assume(owed > cap);

        vm.prank(who);
        vm.expectRevert(CardsOfCronosSetOne.TooManyAtOnce.selector);
        nft.claim(owed, proof, owed);

        vm.prank(who);
        nft.claim(owed, proof, cap);
        vm.prank(who);
        nft.claim(owed, proof, owed - cap);

        assertEq(nft.claimed(who), owed);
        assertEq(nft.balanceOf(who), owed);
    }

    function test_claimingInPartsUpToTheAllowanceAndOneOver() public {
        // Somebody owed sixty-three should not have to take them in one
        // transaction, and should not be able to take sixty-four across two.
        (address who, uint256 owed, bytes32[] memory proof) = smallClaim();

        vm.prank(who);
        nft.claim(owed, proof, 1);
        vm.prank(who);
        nft.claim(owed, proof, owed - 1);
        assertEq(nft.claimed(who), owed);

        vm.prank(who);
        vm.expectRevert(CardsOfCronosSetOne.AlreadyClaimed.selector);
        nft.claim(owed, proof, 1);
    }

    function test_inflatingTheAllowanceBreaksTheProof() public {
        // The contract takes the allowance from the caller. That is only safe
        // because one more card is a different leaf.
        (address who, uint256 owed, bytes32[] memory proof) = claimAt(0);
        vm.prank(who);
        vm.expectRevert(CardsOfCronosSetOne.BadProof.selector);
        nft.claim(owed + 1, proof, 1);
    }

    function test_somebodyElsesProof() public {
        (, uint256 owed, bytes32[] memory proof) = claimAt(0);
        address stranger = address(0xBEEF);
        vm.prank(stranger);
        vm.expectRevert(CardsOfCronosSetOne.BadProof.selector);
        nft.claim(owed, proof, 1);
    }

    function test_claimingWhileClosed() public {
        nft.setClaimsOpen(false);
        (address who, uint256 owed, bytes32[] memory proof) = claimAt(0);
        vm.prank(who);
        vm.expectRevert(CardsOfCronosSetOne.ClaimsClosed.selector);
        nft.claim(owed, proof, 1);
    }

    function test_claimingNothing() public {
        (address who, uint256 owed, bytes32[] memory proof) = claimAt(0);
        vm.prank(who);
        vm.expectRevert(CardsOfCronosSetOne.NothingRequested.selector);
        nft.claim(owed, proof, 0);
    }
}

/**
 * Buying, the discount, and the supply cap.
 *
 * Split from the allowlist because none of it needs the file, and a test that
 * reads a file it does not use is a test that fails for the wrong reason the day
 * the file moves.
 */
contract BuyingTest is Test {
    CardsOfCronosSetOne private nft;
    Fake private crocard;

    address private buyer = address(0xB0B);

    function setUp() public {
        nft = new CardsOfCronosSetOne("Cards of Cronos Set 01", "COC1", 5, "ipfs://x/", bytes32(0));
        crocard = new Fake();
        nft.setDiscountToken(IERC20(address(crocard)));
        nft.setSaleOpen(true);
        vm.deal(buyer, 100_000 ether);
    }

    function test_buyingAtFullPrice() public {
        uint256 price = nft.priceFor(buyer);
        assertEq(price, 150 ether, "no CROCARD, no discount");

        vm.prank(buyer);
        nft.buy{value: price * 2}(2);

        assertEq(nft.balanceOf(buyer), 2);
        assertEq(address(nft).balance, price * 2);
    }

    function test_underpayingIsRefused() public {
        uint256 price = nft.priceFor(buyer);
        vm.prank(buyer);
        vm.expectRevert(
            abi.encodeWithSelector(CardsOfCronosSetOne.Underpaid.selector, price, price - 1)
        );
        nft.buy{value: price - 1}(1);
    }

    function test_overpayingIsRefunded() public {
        // The first collection kept the difference. This one hands it back, so
        // the test is about the buyer's balance rather than the contract's.
        uint256 price = nft.priceFor(buyer);
        uint256 before = buyer.balance;

        vm.prank(buyer);
        nft.buy{value: price + 7 ether}(1);

        assertEq(buyer.balance, before - price, "the extra should have come back");
        assertEq(address(nft).balance, price);
    }

    function test_theDiscountAtEveryEdge() public {
        // Integer division, which is the part that surprises people: anything
        // under a million rounds to nothing at all.
        crocard.setBalance(buyer, 999_999e18);
        assertEq(nft.discountFor(buyer), 0, "just under a million is no discount");

        crocard.setBalance(buyer, 1_000_000e18);
        assertEq(nft.discountFor(buyer), 1, "a million is one percent");

        crocard.setBalance(buyer, 29_000_000e18);
        assertEq(nft.discountFor(buyer), 29);

        crocard.setBalance(buyer, 30_000_000e18);
        assertEq(nft.discountFor(buyer), 30);

        crocard.setBalance(buyer, 900_000_000e18);
        assertEq(nft.discountFor(buyer), 30, "and it is capped there");

        assertEq(nft.priceFor(buyer), (150 ether * 70) / 100);
    }

    function test_buyingWithADiscountPaysTheDiscountedPrice() public {
        crocard.setBalance(buyer, 10_000_000e18);
        uint256 price = nft.priceFor(buyer);
        assertEq(price, (150 ether * 90) / 100);

        vm.prank(buyer);
        nft.buy{value: price}(1);
        assertEq(address(nft).balance, price);
    }

    function test_theSupplyCapHolds() public {
        uint256 price = nft.priceFor(buyer);
        vm.prank(buyer);
        nft.buy{value: price * 5}(5);
        assertEq(nft.nextTokenId(), 6);

        vm.prank(buyer);
        vm.expectRevert(CardsOfCronosSetOne.SoldOut.selector);
        nft.buy{value: price}(1);
    }

    function test_moreThanFiftyAtOnce() public {
        vm.prank(buyer);
        vm.expectRevert(CardsOfCronosSetOne.TooManyAtOnce.selector);
        nft.buy{value: 100_000 ether}(51);
    }

    function test_buyingWhileClosed() public {
        nft.setSaleOpen(false);
        vm.prank(buyer);
        vm.expectRevert(CardsOfCronosSetOne.SaleClosed.selector);
        nft.buy{value: 150 ether}(1);
    }

    function test_tokenUriSaysNoRatherThanNothing() public {
        // The price is read into a local BEFORE the prank, and that is not
        // style. `vm.prank` applies to the next call the test makes, and
        // `nft.priceFor(buyer)` inside the argument list is a call — so it ate
        // the prank and `buy` ran as this test contract, which does not
        // implement onERC721Received and reverted with ERC721InvalidReceiver.
        //
        // Twenty minutes of that error pointing at the contract, and it was the
        // test. Every other test here happens to compute the price first, which
        // is why this was the only one that failed.
        uint256 price = nft.priceFor(buyer);
        vm.prank(buyer);
        nft.buy{value: price}(1);
        assertEq(nft.tokenURI(1), "ipfs://x/1");

        vm.expectRevert(CardsOfCronosSetOne.NoSuchToken.selector);
        nft.tokenURI(2);
    }

    function test_onlyTheOwnerHoldsTheLevers() public {
        vm.startPrank(buyer);
        vm.expectRevert();
        nft.setBaseURI("ipfs://mine/");
        vm.expectRevert();
        nft.setAllowlistRoot(bytes32(uint256(1)));
        vm.expectRevert();
        nft.setMintPrice(1);
        vm.expectRevert();
        nft.withdraw(payable(buyer));
        vm.stopPrank();
    }

    function test_withdrawing() public {
        uint256 price = nft.priceFor(buyer);
        vm.prank(buyer);
        nft.buy{value: price}(1);

        address payable to = payable(address(0xCAFE));
        nft.withdraw(to);
        assertEq(to.balance, price);
        assertEq(address(nft).balance, 0);
    }
}

/** A stand-in for $CROCARD. Only balanceOf is ever called. */
contract Fake is IERC20 {
    mapping(address => uint256) private balances;

    function setBalance(address who, uint256 amount) external {
        balances[who] = amount;
    }

    function balanceOf(address who) external view returns (uint256) {
        return balances[who];
    }

    function totalSupply() external pure returns (uint256) {
        return 0;
    }

    function transfer(address, uint256) external pure returns (bool) {
        return false;
    }

    function allowance(address, address) external pure returns (uint256) {
        return 0;
    }

    function approve(address, uint256) external pure returns (bool) {
        return false;
    }

    function transferFrom(address, address, uint256) external pure returns (bool) {
        return false;
    }
}
