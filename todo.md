Next.js
AppKit has support for Wagmi and Ethers v6 on Ethereum, @solana/web3.js on Solana and Bitcoin. Choose one of these to get started.

Note
These steps are specific to Next.js app router. For other React frameworks read the React documentation.

Installation
If you prefer referring to a video tutorial for this, please click here.

AppKit CLI
Reown offers a dedicated CLI to set up a minimal version of AppKit in the easiest and quickest way possible.

To do this, please run the command below.

npx @reown/appkit-cli

After running the command, you will be prompted to confirm the installation of the CLI. Upon your confirmation, the CLI will request the following details:

Project Name: Enter the name for your project.
Framework: Select your preferred framework or library. Currently, you have three options: React, Next.js, and Vue.
Network-Specific libraries: Choose whether you want to install Wagmi, Ethers, Solana, or Multichain (EVM + Solana).
After providing the project name and selecting your preferences, the CLI will install a minimal example of AppKit with your preferred blockchain library. The example will be pre-configured with a projectId that will only work on localhost.

To fully configure your project, please obtain a projectId from the Reown Cloud Dashboard and update your project accordingly.

Refer to this section for more information.

Custom Installation
Wagmi
Ethers
Ethers v5
Solana
Bitcoin
npm
Yarn
Bun
pnpm
npm install @reown/appkit @reown/appkit-adapter-ethers ethers

Cloud Configuration
Create a new project on Reown Cloud at https://cloud.reown.com and obtain a new project ID.

Don't have a project ID?
Head over to Reown Cloud and create a new project now!

Get started
cloud illustration
Implementation
Wagmi
Ethers
Ethers v5
Solana
Bitcoin
GitHub
ethers Example
Check the Next ethers example

In this example we will create a new file called context/appkit.tsx outside our app directory and set up the following configuration

'use client'

import { createAppKit } from '@reown/appkit/react'
import { EthersAdapter } from '@reown/appkit-adapter-ethers'
import { mainnet, arbitrum } from '@reown/appkit/networks'

// 1. Get projectId at https://cloud.reown.com
const projectId = 'YOUR_PROJECT_ID'

// 2. Create a metadata object
const metadata = {
  name: 'My Website',
  description: 'My Website description',
  url: 'https://mywebsite.com', // origin must match your domain & subdomain
  icons: ['https://avatars.mywebsite.com/']
}

// 3. Create the AppKit instance
createAppKit({
  adapters: [new EthersAdapter()],
  metadata,
  networks: [mainnet, arbitrum],
  projectId,
  features: {
    analytics: true // Optional - defaults to your Cloud configuration
  }
})

export function AppKit() {
  return (
    <YourApp /> //make sure you have configured the <appkit-button> inside
  )
}

Next, in your app/layout.tsx or app/layout.jsx file, import the custom AppKit component.

import './globals.css'

import { AppKit } from '../context/appkit'

export const metadata = {
  title: 'AppKit',
  description: 'AppKit Example'
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <AppKit>{children}</AppKit>
      </body>
    </html>
  )
}

IMPORTANT
Make sure that the url from the metadata matches your domain and subdomain. This will later be used by the Verify API to tell wallets if your application has been verified or not.

Trigger the modal
Wagmi
Ethers
Ethers v5
Solana
Bitcoin
To open AppKit you can use our web component or build your own button with AppKit hooks.

Web Component
Hooks
export default function ConnectButton() {
  return <appkit-button />
}

Learn more about the AppKit web components here

note
Web components are global html elements that don't require importing.

Smart Contract Interaction
Wagmi
Ethers
Solana
Ethers can help us interact with wallets and smart contracts:

import { useAppKitProvider, useAppKitAccount } from "@reown/appkit/react"
import { BrowserProvider, Contract, formatUnits } from 'ethers'

const USDTAddress = '0x617f3112bf5397D0467D315cC709EF968D9ba546'

// The ERC-20 Contract ABI, which is a common contract interface
// for tokens (this is the Human-Readable ABI format)
const USDTAbi = [
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function balanceOf(address) view returns (uint)',
  'function transfer(address to, uint amount)',
  'event Transfer(address indexed from, address indexed to, uint amount)'
]

function Components() {
  const { address, caipAddress, isConnected } = useAppKitAccount();
  const { walletProvider } = useAppKitProvider('eip155')

  async function getBalance() {
    if (!isConnected) throw Error('User disconnected')

    const ethersProvider = new BrowserProvider(walletProvider)
    const signer = await ethersProvider.getSigner()
    // The Contract object
    const USDTContract = new Contract(USDTAddress, USDTAbi, signer)
    const USDTBalance = await USDTContract.balanceOf(address)

    console.log(formatUnits(USDTBalance, 18))
  }

  return <button onClick={getBalance}>Get User Balance</button>
}

Extra configuration
Next.js relies on SSR. This means some specific steps are required to make AppKit work properly.

Add the following code in the next.config.js file
// Path: next.config.js
const nextConfig = {
  webpack: config => {
    config.externals.push('pino-pretty', 'lokijs', 'encoding')
    return config
  }
}

Learn more about SSR with Wagmi
Video Tutorial

Hooks
Hooks are functions that will help you control the modal, subscribe to wallet events and interact with them and smart contracts.

useAppKit
Hook for controlling the modal.

import { useAppKit } from '@reown/appkit/react'

export default function Component() {
  const { open, close } = useAppKit()
}

Returns
open: Function to open the modal
close: Function to close the modal
Parameters
You can also select the modal's view when calling the open function

open({ view: 'Account' })

// to connect and show multi wallets view
open({ view: 'Connect'})

// to connect and show only solana wallets
open({ view: 'Connect', namespace: 'solana' })

// to connect and show only bitcoin wallets
open({ view: 'Connect', namespace: 'bip122' })

// to connect and show only ethereum wallets
open({ view: 'Connect', namespace: 'eip155' })

List of views you can select

Variable	Description
Connect	Principal view of the modal - default view when disconnected. A `namespace` can be selected to connect to a specific network (solana, bip122 or eip155)
Account	User profile - default view when connected
AllWallets	Shows the list of all available wallets
Networks	List of available networks - you can select and target a specific network before connecting
WhatIsANetwork	"What is a network" onboarding view
WhatIsAWallet	"What is a wallet" onboarding view
OnRampProviders	On-Ramp main view
Swap	Swap main view
useAppKitAccount
Hook for accessing account data and connection status.

import { useAppKitAccount } from "@reown/appkit/react";

const { address, isConnected, caipAddress, status, embeddedWalletInfo } = useAppKitAccount()


Hook for accessing account data and connection status for each namespace when working in a multi-chain environment.

import { useAppKitAccount } from "@reown/appkit/react";

const eip155Account = useAppKitAccount({ namespace: 'eip155' }) // for EVM chains
const solanaAccount = useAppKitAccount({ namespace: 'solana' })
const bip122Account = useAppKitAccount({ namespace: 'bip122' }) // for bitcoin

Returns
allAccounts: A list of connected accounts
address: The current account address
caipAddress: The current account address in CAIP format
isConnected: Boolean that indicates if the user is connected
status: The current connection status
embeddedWalletInfo: The current embedded wallet information
type EmbeddedWalletInfo {
  user: {
    username: string
    email: string
  },
  accountType: 'eoa' | 'smartAccount',
  authProvider: 'google' | 'apple' | 'facebook' | 'x' | 'discord' | 'farcaster' | 'github' | 'email',
  isSmartAccountDeployed: boolean
}

type ConnectionStatus = 'connected' | 'disconnected' | 'connecting' | 'reconnecting'

type UseAppKitAccountReturnType = {
  isConnected: boolean
  allAccounts: Account[]
  status?: ConnectionStatus
  address?: string
  caipAddress?: `${string}:${string}`
  embeddedWalletInfo?: EmbeddedWalletInfo
}


useAppKitNetwork
Hook for accessing network data and methods.

import { useAppKitNetwork } from "@reown/appkit/react";

export default Component(){
  const { caipNetwork, caipNetworkId, chainId, switchNetwork } = useAppKitNetwork()
}


Returns
caipNetwork: The current network object
caipNetworkId: The current network id in CAIP format
chainId: The current chain id
switchNetwork: Function to switch the network. Accepts a caipNetwork object as argument.
info
See how to import or create a networks here.

useAppKitState
Hook for getting the current value of the modal's state.

import { useAppKitState } from '@reown/appkit/react'

const { open, selectedNetworkId } = useAppKitState()

Returns
open: Boolean that indicates if the modal is open
selectedNetworkId: The current chain id selected by the user
useAppKitTheme
Hook for controlling the modal's theme.

import { useAppKitTheme } from '@reown/appkit/react'
const { themeMode, themeVariables, setThemeMode, setThemeVariables } = useAppKitTheme()

setThemeMode('dark')

setThemeVariables({
  '--w3m-color-mix': '#00BB7F',
  '--w3m-color-mix-strength': 40
})


useAppKitEvents
Hook for subscribing to modal events.

import { useAppKitEvents } from '@reown/appkit/react'

const events = useAppKitEvents()

useDisconnect
Hook for disconnecting the session.

import { useDisconnect } from '@reown/appkit/react'

const { disconnect } = useDisconnect()

await disconnect()

useWalletInfo
Hook for accessing wallet information.

import { useWalletInfo } from '@reown/appkit/react'


export default Component(){
  const { walletInfo } = useWalletInfo()
}

useAppKitWallet

Using the wallet button hooks (Demo in our Lab), you can directly connect to the top 20 wallets, WalletConnect QR and also all the social logins. This hook allows to customize dApps, enabling users to connect their wallets effortlessly, all without the need to open the traditional modal. Execute this command to install the library for use it:

npm
Yarn
Bun
pnpm
npm i @reown/appkit-wallet-button

Then you have to import the hook in your project:

import { useAppKitWallet } from '@reown/appkit-wallet-button/react'

And finally, you can use the hook in your project:

const { isReady, isPending, connect } = useAppKitWallet({
    onSuccess() {
      // ...
    },
    onError(error) {
      // ...
    }
  })

...

// Connect to a wallet
<Button onClick={() => connect("walletConnect")} />

Options for the connect parameter
Type	Options
QR Code
walletConnect
Wallets
metamask, trust, coinbase, rainbow, jupiter, solflare, coin98, magic-eden, backpack, frontier and phantom
Social logins
google, github, apple, facebook, x, discord and farcaster
Ethereum/Solana Library
Wagmi
Ethers
Ethers v5
Solana
useAppKitAccount
Hook that returns the client's information.

import { useAppKitAccount } from '@reown/appkit/react'

function Components() {
  const { address, caipAddress, isConnected } = useAppKitAccount();

  //...
}

switchNetwork
import { createAppKit } from '@reown/appkit/react'
import { mainnet, arbitrum, polygon } from '@reown/appkit/networks'

const modal = createAppKit({
  adapters: [wagmiAdapter],
  projectId,
  networks: [mainnet, arbitrum],
  metadata: metadata,
  features: {
    analytics: true,
  }
})

modal.switchNetwork(polygon)

useAppKitProvider
Hook that returns the walletProvider and the WalletProviderType.

import { BrowserProvider } from 'ethers'
import { useAppKitProvider } from '@reown/appkit/react'

function Components() {
  const { walletProvider } = useAppKitProvider('eip155')

  async function onSignMessage() {
    const provider = new BrowserProvider(walletProvider)
    const signer = await provider.getSigner()
    const signature = await signer?.signMessage('Hello AppKit Ethers')
    console.log(signature)
  }

  return <button onClick={() => onSignMessage()}>Sign Message</button>
}

getError
function Components() {
  const error = modal.getError();
  //...
}

Learn More About Ethers
Edit this page
Last updated on Mar 11, 2025
Previous
Installation


Options
Options
The following options can be passed to the createAppKit function:

createAppKit({ adapters, projectId, networks, ...options })

networks
Array of networks that can be chosen from the @reown/appkit/networks library. This library retrieves the list of EVM networks from Viem and also includes the Solana networks.

import { mainnet, solana } from '@reown/appkit/networks'

createAppKit({
  // ...
  networks: [mainnet, solana]
})

For custom networks, refer to this doc page.

metadata
Metadata for your AppKit. The name, description, icons, and url are used at certain places like the wallet connection, sign message, etc screens. If not provided, they will be fetched from the metadata of your website's document object.

createAppKit({
  // ...
  metadata: {
    name: 'My App',
    description: 'My App Description',
    icons: ['https://myapp.com/icon.png'],
    url: 'https://myapp.com'
  }
})

For custom networks, refer to this doc page.

defaultNetwork
Desired network for the initial connection as default:

Wagmi
Ethers
Solana
const mainnet = {
  chainId: 1,
  name: 'Ethereum',
  currency: 'ETH',
  explorerUrl: 'https://etherscan.io',
  rpcUrl: 'https://cloudflare-eth.com'
}

createAppKit({
  //...
  defaultNetwork: mainnet
})

defaultAccountTypes
It allows you to configure the default account selected for the specified networks in AppKit. For example, if you want your EVM networks to use an EOA account by default, you can configure it as shown in the code below.

createAppKit({
  //...
  defaultAccountTypes: {eip155:'eoa'}
})

Here are all the options you have for each network identifier or networks. Network identifier or networks available are eip155 for EVM chains, solana for Solana, bip122 for Bitcoin, and polkadot for Polkadot.

type DefaultAccountTypes = {
    eip155: "eoa" | "smartAccount";
    solana: "eoa";
    bip122: "payment" | "ordinal" | "stx";
    polkadot: "eoa";
}

featuredWalletIds
Select wallets that are going to be shown on the modal's main view. Default wallets are MetaMask and Trust Wallet. Array of wallet ids defined will be prioritized (order is respected). These wallets will also show up first in All Wallets view. You can find the wallets IDs in Wallets List or in WalletGuide

createAppKit({
  //...
  featuredWalletIds: [
    '1ae92b26df02f0abca6304df07debccd18262fdf5fe82daa81593582dac9a369',
    '4622a2b2d6af1c9844944291e5e7351a6aa24cd7b23099efac1b2fd875da31a0'
  ]
})

chainImages
Add or override the modal's network images.

createAppKit({
  // ...
  chainImages: {
    1: 'https://my.images.com/eth.png'
  }
})

connectorImages
Wagmi
Ethers
Solana
Set or override the images of any connector.

createAppKit({
  connectorImages: {
    coinbaseWallet: 'https://images.mydapp.com/coinbase.png',
    walletConnect: 'https://images.mydapp.com/walletconnect.png'
  }
})

enableWalletConnect
Enable or disable WalletConnect QR feature. Default is true.

enableWalletConnect: false

debug
Enable or disable debug mode in your AppKit. This is useful if you want to see UI alerts when debugging. Default is false.

debug: true

enableWalletGuide
Enable or disable the wallet guide text, is useful for people that don't have a wallet yet. Default is true.

createAppKit({
  //...
  enableWalletGuide: false
})

termsConditionsUrl
You can add an url for the terms and conditions link.

createAppKit({
  //...
  termsConditionsUrl: 'https://www.mytermsandconditions.com'
})

privacyPolicyUrl
A URL for the privacy policy link.

createAppKit({
  //...
  privacyPolicyUrl: 'https://www.myprivacypolicy.com'
})

features
Allows you to toggle (enable or disable) additional features provided by AppKit. Features such as analytics, email and social logins, On-ramp, swaps, etc., can be enabled using this parameter.

analytics
Enable analytics to get more insights on your users activity within your Reown Cloud's dashboard

createAppKit({
  //...
  features: {
    analytics: true
  }
})

Learn More
swaps
Enable or disable the swap feature in your AppKit. Swaps feature is enabled by default.

createAppKit({
  //...
  features: {
    swaps: true
  }
})

onramp
Enable or disable the onramp feature in your AppKit. Onramp feature is enabled by default.

createAppKit({
  //...
  features: {
    onramp: true
  }
})

connectMethodsOrder
Order of the connection methods in the modal. The default order is ['wallet', 'email', 'social'].


createAppKit({
  //...
  features: {
    connectMethodsOrder: ['social', 'email', 'wallet'],
  }
})

legalCheckbox
Enable or disable the terms of service and/or privacy policy checkbox.

createAppKit({
  //...
  features: {
    legalCheckbox: true
  }
})


customWallets
Adds custom wallets to the modal. customWallets is an array of objects, where each object contains specific information of a custom wallet.

createAppKit({
  //...
  customWallets: [
    {
      id: 'myCustomWallet',
      name: 'My Custom Wallet',
      homepage: 'www.mycustomwallet.com', // Optional
      image_url: 'my_custom_wallet_image', // Optional
      mobile_link: 'mobile_link', // Optional - Deeplink or universal
      desktop_link: 'desktop_link', // Optional - Deeplink
      webapp_link: 'webapp_link', // Optional
      app_store: 'app_store', // Optional
      play_store: 'play_store' // Optional
    }
  ]
})

AllWallets
caution
If the "All Wallets" button is removed on mobile, all the mobile wallets that were not added on the main view of the modal won't be able to connect to your website via WalletConnect protocol.

The allWallets parameter allows you to add or remove the "All Wallets" button on the modal.

Value	Description
SHOW	Shows the "All Wallets" button on AppKit.
HIDE	Removes the "All Wallets" button from AppKit.
ONLY_MOBILE	Shows the "All Wallets" button on AppKit only on mobile.
createAppKit({
  //...
  allWallets: 'ONLY_MOBILE'
})

includeWalletIds & excludeWalletIds
caution
Wallets that are either not included or excluded won't be able to connect to your website on mobile via WalletConnect protocol.

includeWalletIds
Override default recommended wallets that are fetched from WalletGuide. Array of wallet ids defined will be shown (order is respected). Unlike featuredWalletIds, these wallets will be the only ones shown in All Wallets view and as recommended wallets. You can find the wallets IDs in our Wallets List.

createAppKit({
  //...
  includeWalletIds: [
    '1ae92b26df02f0abca6304df07debccd18262fdf5fe82daa81593582dac9a369',
    '4622a2b2d6af1c9844944291e5e7351a6aa24cd7b23099efac1b2fd875da31a0'
  ]
})

excludeWalletIds
Exclude wallets that are fetched from WalletGuide. Array of wallet ids defined will be excluded. All other wallets will be shown in respective places. You can find the wallets IDs in our Wallets List.

createAppKit({
  //...
  excludeWalletIds: [
    '1ae92b26df02f0abca6304df07debccd18262fdf5fe82daa81593582dac9a369',
    '4622a2b2d6af1c9844944291e5e7351a6aa24cd7b23099efac1b2fd875da31a0'
  ]
})

Coinbase Smart Wallet
The Coinbase connector now includes a new flag to customize the Smart Wallet behavior.

Note
To enable the Coinbase Smart Wallet feature, ensure that AppKit is updated to version 4.2.3 or higher. Additionally, if you are using Wagmi, verify that it is on the latest version.

The preference (or coinbasePreference) flag accepts one of the following string values:

eoaOnly: Uses EOA Browser Extension or Mobile Coinbase Wallet.
smartWalletOnly: Displays Smart Wallet popup.
all (default): Supports both eoaOnly and smartWalletOnly based on context.
Wagmi
Ethers
createAppKit({
  //...
  enableCoinbase: true, // true by default
  coinbasePreference: 'smartWalletOnly'
})

Edit this page
Last updated on Mar 6, 2025
Previous
Hooks
Next
Components
networks
metadata
defaultNetwork
defaultAccountTypes
featuredWalletIds
chainImages
connectorImages
enableWalletConnect
debug
enableWalletGuide
termsConditionsUrl
privacyPolicyUrl
features
analytics
swaps
onramp
connectMethodsOrder
legalCheckbox
customWallets
AllWallets
includeWalletIds & excludeWalletIds
includeWalletIds
excludeWalletIds


Web Components
AppKit's web components are custom and reusable HTML tags. They will work across modern browsers, and can be used with any JavaScript library or framework that works with HTML.

info
Web components are global html elements that don't require importing.

List of optional properties for AppKit web components
<appkit-button />
Variable	Description	Type
disabled	Enable or disable the button.
boolean
balance	Show or hide the user's balance.
'show' | 'hide'
size	Default size for the button.
'md' | 'sm'
label	The text shown in the button.
string
loadingLabel	The text shown in the button when the modal is open.
string
namespace	Option to show specific namespace account info. Note: `eip155` is for EVM and `bip122` is for Bitcoin.
'eip155' | 'solana' | 'bip122'
<appkit-account-button />
Variable	Description	Type
disabled	Enable or disable the button.
boolean
balance	Show or hide the user's balance.
'show' | 'hide'
<appkit-connect-button />
Variable	Description	Type
size	Default size for the button.
'md' | 'sm'
label	The text shown in the button.
string
loadingLabel	The text shown in the button when the modal is open.
string
<appkit-network-button />
Variable	Description	Type
disabled	Enable or disable the button.
boolean
<appkit-wallet-button />

Using the wallet button components (Demo in our Lab), you can directly connect to the top 20 wallets, WalletConnect QR and also all the social logins. This component allows to customize dApps, enabling users to connect their wallets effortlessly, all without the need for the traditional modal.

Follow these steps to use the component:

Install the package:
npm
Yarn
Bun
pnpm
npm i @reown/appkit-wallet-button

Import the library in your project:
import '@reown/appkit-wallet-button/react'

use the component in your project:
<appkit-wallet-button wallet="metamask" />

Options for wallet property
Type	Options
QR Code
walletConnect
Wallets
metamask, trust, coinbase, rainbow, coinbase, jupiter, solflare, coin98, magic-eden, backpack, frontier and phantom
Social logins
google, github, apple, facebook, x, discord and farcaster
Edit this page
Last updated on Mar 6, 2025

Theming
The theme for the AppKit integration in your dApp can be fully customized. Below are some examples:

Wormfare
ThemeMode
By default themeMode option will be set to user system settings 'light' or 'dark'. But you can override it like this:

createAppKit({
  //...
  themeMode: 'light'
})

themeVariables
By default themeVariables are undefined. You can set them like this:

createAppKit({
  //...
  themeVariables: {
    '--w3m-color-mix': '#00BB7F',
    '--w3m-color-mix-strength': 40
  }
})

The following list shows the theme variables you can override:

Variable	Description	Type
--w3m-font-family	Base font family
string
--w3m-accent	Color used for buttons, icons, labels, etc.
string
--w3m-color-mix	The color that blends in with the default colors
string
--w3m-color-mix-strength	The percentage on how much "--w3m-color-mix" should blend in
number
--w3m-font-size-master	The base pixel size for fonts.
string
--w3m-border-radius-master	The base border radius in pixels.
string
--w3m-z-index	The z-index of the modal.
number
Wallet Buttons
Wallet buttons are components that allow users to connect their wallets to your dApp. They provide a simple and easy way to connect to the top 20 wallets, WalletConnect QR, and all the social logins. You can also call them directly using hooks. Please check the components and hooks documentation for more information.



Try Wallet Buttons
Edit this page
Last updated on Mar 6, 2025
Previous
Multichain
Next
Resources
ThemeMode
themeVariables

