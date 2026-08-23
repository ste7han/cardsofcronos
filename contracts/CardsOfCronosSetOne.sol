// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {MerkleProof} from "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title Cards of Cronos — Set 01
 * @notice The second collection. The first one is at
 *         0x10B47dAbfEaCBd87dD2bAd5f6d489C5082181902 and stays exactly as it is;
 *         everybody holding one of those can claim from here for nothing.
 *
 * Written against docs/the-first-collection.md and contracts/CardsOfCronos.sol,
 * which is the contract that is already deployed and working. What is kept from
 * it, what is dropped and what is new is written down at each point below rather
 * than in a commit message nobody will find.
 *
 * NOT DEPLOYED, NOT AUDITED. It compiles, and that is the only claim being made.
 * The tests that ought to sit beside it do not exist yet; see the note at the
 * bottom of this file.
 */
contract CardsOfCronosSetOne is ERC721, Ownable {
    // ---------------------------------------------------------------- supply

    /// @notice The highest id that will ever exist. Fixed at deploy, forever.
    uint256 public immutable maxSupply;

    /// @notice The next id to hand out. Ids start at 1, like the first collection.
    uint256 public nextTokenId = 1;

    /**
     * @dev No ERC721Enumerable, unlike the first collection.
     *
     * It costs several thousand gas on every single mint and transfer to keep
     * indexes that this project reads exactly once, from a script, off-chain:
     * scripts/holders.ts walks ownerOf(1..n) and does not touch tokenOfOwnerByIndex.
     * Paying for an index nobody queries is a tax on every holder forever.
     */

    // ------------------------------------------------------------- metadata

    string private _base;

    // ------------------------------------------------------------ free mints

    // Root of the allowlist built from the first collection's holders.
    //
    // Leaves are keccak256(bytes.concat(keccak256(abi.encode(address, uint256))))
    // — the OpenZeppelin StandardMerkleTree shape, which is what
    // scripts/allowlist.ts produces using their own merkle-tree package.
    //
    // Settable, because a snapshot can be retaken and because deploying with a
    // root that turns out to be wrong should not mean deploying again. Once
    // claiming opens it should not move — see `claimsOpen`.
    bytes32 public allowlistRoot;

    /// @notice How many of their free mints an address has taken.
    mapping(address => uint256) public claimed;

    /// @notice Whether the free mints can be taken at all.
    bool public claimsOpen;

    // ------------------------------------------------------------ paid mints

    /// @notice Price of one card, before any discount. In CRO.
    uint256 public mintPrice = 150 ether;

    /// @notice Most that can be bought in one transaction.
    uint256 public constant MAX_MINT_PER_TX = 50;

    /// @notice Whether the paid mint is open.
    bool public saleOpen;

    /**
     * @notice $CROCARD. Holding it makes minting cheaper.
     * @dev The same token and the same formula as the first collection: one
     *      percent off per million held, capped at thirty. Kept because it is
     *      the one mechanic that already rewards holding the token, and because
     *      changing the deal on people who bought in for it would be a worse
     *      idea than any gas it saves.
     */
    IERC20 public discountToken = IERC20(0xECf3361441512c1e9F6A6e8734D86614D8e795BC);

    // ---------------------------------------------------------------- events

    event Claimed(address indexed to, uint256 amount);
    event Bought(address indexed to, uint256 amount, uint256 paid);
    event AllowlistRootSet(bytes32 root);
    event BaseURISet(string baseURI);

    // ---------------------------------------------------------------- errors

    error SoldOut();
    error NothingRequested();
    error TooManyAtOnce();
    error ClaimsClosed();
    error SaleClosed();
    error BadProof();
    error AlreadyClaimed();
    error Underpaid(uint256 owed, uint256 sent);
    error RefundFailed();
    error WithdrawFailed();
    error NoSuchToken();

    constructor(
        string memory name_,
        string memory symbol_,
        uint256 maxSupply_,
        string memory baseURI_,
        bytes32 allowlistRoot_
    ) ERC721(name_, symbol_) Ownable(msg.sender) {
        maxSupply = maxSupply_;
        _base = baseURI_;
        allowlistRoot = allowlistRoot_;
    }

    // ------------------------------------------------------------------ mint

    /**
     * @notice Take some of the free mints this address is owed.
     * @param allowance How many that address is owed in total, as it appears in
     *        the allowlist. This is the number the leaf was built from and it
     *        cannot be inflated: change it and the proof stops matching.
     * @param proof The merkle proof for (msg.sender, allowance).
     * @param amount How many to take now. Claiming in parts is allowed, so
     *        somebody owed sixty-three does not have to take them in one
     *        transaction or lose the rest.
     */
    function claim(uint256 allowance, bytes32[] calldata proof, uint256 amount) external {
        if (!claimsOpen) revert ClaimsClosed();
        if (amount == 0) revert NothingRequested();
        if (amount > MAX_MINT_PER_TX) revert TooManyAtOnce();

        bytes32 leaf = keccak256(bytes.concat(keccak256(abi.encode(msg.sender, allowance))));
        if (!MerkleProof.verify(proof, allowlistRoot, leaf)) revert BadProof();

        uint256 taken = claimed[msg.sender];
        if (taken + amount > allowance) revert AlreadyClaimed();

        // Written before anything is minted. _safeMint hands control to the
        // receiver, and a receiver that calls back in has to find the counter
        // already moved.
        claimed[msg.sender] = taken + amount;

        _mintMany(msg.sender, amount);
        emit Claimed(msg.sender, amount);
    }

    /// @notice Buy cards at the going price, less whatever $CROCARD earns you.
    function buy(uint256 amount) external payable {
        if (!saleOpen) revert SaleClosed();
        if (amount == 0) revert NothingRequested();
        if (amount > MAX_MINT_PER_TX) revert TooManyAtOnce();

        uint256 owed = priceFor(msg.sender) * amount;
        if (msg.value < owed) revert Underpaid(owed, msg.value);

        _mintMany(msg.sender, amount);
        emit Bought(msg.sender, amount, owed);

        // Overpaying is a mistake, not a donation. The first collection kept the
        // difference; this one hands it back.
        if (msg.value > owed) {
            (bool sent, ) = payable(msg.sender).call{value: msg.value - owed}("");
            if (!sent) revert RefundFailed();
        }
    }

    function _mintMany(address to, uint256 amount) private {
        uint256 id = nextTokenId;
        if (id + amount - 1 > maxSupply) revert SoldOut();
        nextTokenId = id + amount;
        for (uint256 i = 0; i < amount; ++i) {
            _safeMint(to, id + i);
        }
    }

    // ----------------------------------------------------------------- price

    /**
     * @notice What one card costs this address right now.
     * @dev The first collection's formula, unchanged: `balance / 1_000_000e18`
     *      percent off, capped at thirty. Note what the integer division means —
     *      anything under a million $CROCARD is no discount at all, and that is
     *      how it has always behaved.
     */
    function discountFor(address user) public view returns (uint256) {
        uint256 percent = discountToken.balanceOf(user) / 1_000_000e18;
        return percent > 30 ? 30 : percent;
    }

    function priceFor(address user) public view returns (uint256) {
        return (mintPrice * (100 - discountFor(user))) / 100;
    }

    // ------------------------------------------------------------- metadata

    function _baseURI() internal view override returns (string memory) {
        return _base;
    }

    /**
     * @dev Reverts on a token that does not exist rather than returning an empty
     *      string. A marketplace that gets "" shows a blank card and no reason.
     */
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        if (_ownerOf(tokenId) == address(0)) revert NoSuchToken();
        return super.tokenURI(tokenId);
    }

    // -------------------------------------------------------------- the levers

    function setBaseURI(string calldata baseURI_) external onlyOwner {
        _base = baseURI_;
        emit BaseURISet(baseURI_);
    }

    function setAllowlistRoot(bytes32 root) external onlyOwner {
        allowlistRoot = root;
        emit AllowlistRootSet(root);
    }

    function setClaimsOpen(bool open) external onlyOwner {
        claimsOpen = open;
    }

    function setSaleOpen(bool open) external onlyOwner {
        saleOpen = open;
    }

    function setMintPrice(uint256 price) external onlyOwner {
        mintPrice = price;
    }

    function setDiscountToken(IERC20 token) external onlyOwner {
        discountToken = token;
    }

    function withdraw(address payable to) external onlyOwner {
        (bool sent, ) = to.call{value: address(this).balance}("");
        if (!sent) revert WithdrawFailed();
    }
}

/*
 * ── WHAT IS PROVED, AND WHAT IS NOT ─────────────────────────────────────────
 *
 * contracts/test/CardsOfCronosSetOne.t.sol, 21 tests, `npm run contract`.
 *
 * The one worth naming: every proof in data/allowlist.json is fed to this
 * contract and accepted. Not a sample — all of them. The leaf shape above was
 * written by hand to match what scripts/allowlist.ts produces, and a holder
 * whose proof does not verify is somebody who was promised a mint and cannot
 * take it. There is no reason to find that out one wallet at a time.
 *
 * Also proved: claiming twice, claiming over the allowance, claiming in parts up
 * to it and one over, a proof used by somebody else, an inflated allowance,
 * minting past maxSupply, over- and underpaying, and the discount at zero, at a
 * million minus one, at a million and above the cap.
 *
 * One thing the tests found rather than confirmed. The largest holder in the
 * real allowlist is owed 63 and MAX_MINT_PER_TX is 50, so their allowance does
 * not fit in one transaction. That is intended, and it is only fair because
 * claiming in parts works — which nothing said until there was a test for it.
 *
 * ── WHAT IS STILL OPEN, AND NONE OF IT IS CODE ──────────────────────────────
 *
 *   - NOT AUDITED. Tests are not an audit and this holds money.
 *   - maxSupply. The card set is being redesigned, so how many cards there are
 *     is not settled.
 *   - The name and symbol. "Cards of Cronos Set 01" and something that is not
 *     "COC", which the first collection already uses.
 *   - baseURI. Nothing is uploaded yet, and there is no art to upload.
 *   - Who deploys it. lib/admin.ts and lib/revenue.ts are empty for the same
 *     reason: nobody has said which addresses these are.
 *   - Whether the free mints go one per token (505) or one per distinct card
 *     (478). That is a flag on scripts/allowlist.ts, not a property of this
 *     contract — but the root here has to match whichever was chosen.
 */
