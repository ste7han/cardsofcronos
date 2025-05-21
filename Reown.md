1

Install package

npm
yarn
bun
pnpm
wagmi
ethers
ethers v5
solana
npm i @reown/appkit @reown/appkit-adapter-wagmi wagmi viem @tanstack/react-query

1

Install package


2

Get started

Wagmi config
Create a new file for your Wagmi configuration, since we are going to be calling this function on the client and the server it cannot live inside a file with the 'use client' directive.

For this example we will create a file called config/index.tsx outside our app directory and set up the following configuration



// config/index.tsx

import { cookieStorage, createStorage, http } from '@wagmi/core'
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi'
import { mainnet, arbitrum } from '@reown/appkit/networks'

// Get projectId from https://cloud.reown.com
export const projectId = '7b7cd4d698d7ca7ddab6825056af50ef'

if (!projectId) {
  throw new Error('Project ID is not defined')
}

export const networks = [mainnet, arbitrum]

//Set up the Wagmi Adapter (Config)
export const wagmiAdapter = new WagmiAdapter({
  storage: createStorage({
    storage: cookieStorage
  }),
  ssr: true,
  projectId,
  networks
})

export const config = wagmiAdapter.wagmiConfig

Context Provider
Let's create now a context provider that will wrap our application and initialized AppKit (createAppKit needs to be called inside a React Client Component file).

In this example we will create a file called context/index.tsx outside our app directory and set up the following configuration



// context/index.tsx
'use client'

import { wagmiAdapter, projectId } from '@/config'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createAppKit } from '@reown/appkit/react' 
import { mainnet, arbitrum, avalanche, base, optimism, polygon } from '@reown/appkit/networks'
import React, { type ReactNode } from 'react'
import { cookieToInitialState, WagmiProvider, type Config } from 'wagmi'

// Set up queryClient
const queryClient = new QueryClient()

if (!projectId) {
  throw new Error('Project ID is not defined')
}

// Set up metadata
const metadata = {
  name: 'Roo',
  description: 'AppKit Example',
  url: 'https://reown.com/appkit', // origin must match your domain & subdomain
  icons: ['https://assets.reown.com/reown-profile-pic.png']
}

// Create the modal
const modal = createAppKit({
  adapters: [wagmiAdapter],
  projectId,
  networks: [mainnet, arbitrum, avalanche, base, optimism, polygon],
  defaultNetwork: mainnet,
  metadata: metadata,
  features: {
    analytics: true, // Optional - defaults to your Cloud configuration
  }
})

function ContextProvider({ children, cookies }: { children: ReactNode; cookies: string | null }) {
  const initialState = cookieToInitialState(wagmiAdapter.wagmiConfig as Config, cookies)

  return (
    <WagmiProvider config={wagmiAdapter.wagmiConfig as Config} initialState={initialState}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  )
}

export default ContextProvider
    
Layout
Next, in our app/layout.tsx file, we will import our ContextProvider component and call the Wagmi's functioncookieToInitialState.

The initialState returned by cookieToInitialState, contains the optimistic values that will populate the Wagmi's store both on the server and client.



// app/layout.tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

import { headers } from "next/headers"; // added
import ContextProvider from '@/context'

export const metadata: Metadata = {
  title: "AppKit Example App",
  description: "Powered by WalletConnect"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode
}>) {
  const cookies = headers().get('cookie')

  return (
    <html lang="en">
      <body>
        <ContextProvider cookies={cookies}>{children}</ContextProvider>
      </body>
    </html>
  )
}


Installation

Open in ChatGPT

AppKit has support for Wagmi and Ethers v6 on Ethereum, @solana/web3.js on Solana and Bitcoin. Choose one of these to get started.

These steps are specific to Next.js app router. For other React frameworks read the React documentation.

​
Installation
If you prefer referring to a video tutorial for this, please click here.

​
Set up Reown AppKit using AI
If you’re using Cursor IDE (or another AI based IDE) to build a project with Reown AppKit, Reown provides a .mdc file that enhances your development experience. The reown-appkit.mdc file here contains Cursor-specific rules and type hints for Reown AppKit.

To use it in your project:

Copy the reown-appkit.mdc file from this repository
Create a .cursor/rules folder in your project’s root directory (if it doesn’t exist)
Place the .mdc file in your project’s .cursor/rules folder
For more info, refer to Cursor’s documentation.

​
AppKit CLI
Reown offers a dedicated CLI to set up a minimal version of AppKit in the easiest and quickest way possible.

To do this, please run the command below.


Copy
npx @reown/appkit-cli
After running the command, you will be prompted to confirm the installation of the CLI. Upon your confirmation, the CLI will request the following details:

Project Name: Enter the name for your project.
Framework: Select your preferred framework or library. Currently, you have three options: React, Next.js, and Vue.
Network-Specific libraries: Choose whether you want to install Wagmi, Ethers, Solana, or Multichain (EVM + Solana).
After providing the project name and selecting your preferences, the CLI will install a minimal example of AppKit with your preferred blockchain library. The example will be pre-configured with a projectId that will only work on localhost.

To fully configure your project, please obtain a projectId from the Reown Cloud Dashboard and update your project accordingly.

Refer to this section for more information.

​
Custom Installation
Wagmi
Ethers v5
Ethers
Solana
Bitcoin

npm

Yarn

Bun

pnpm

Copy
npm install @reown/appkit @reown/appkit-adapter-wagmi wagmi viem @tanstack/react-query
​
Cloud Configuration
Create a new project on Reown Cloud at https://cloud.reown.com and obtain a new project ID.

Don’t have a project ID?

Head over to Reown Cloud and create a new project now!

Get started
​
Implementation
Wagmi
Ethers v5
Ethers
Solana
Bitcoin
wagmi Example
Check the Next wagmi example

For a quick integration, you can use the createAppKit function with a unified configuration. This automatically applies the predefined configurations for different adapters like Wagmi, Ethers, or Solana, so you no longer need to manually configure each one individually. Simply pass the common parameters such as projectId, chains, metadata, etc., and the function will handle the adapter-specific configurations under the hood.

This includes WalletConnect, Coinbase and Injected connectors, and the Blockchain API as a transport

​
Wagmi config
Create a new file for your Wagmi configuration, since we are going to be calling this function on the client and the server it cannot live inside a file with the ‘use client’ directive.

For this example we will create a file called config/index.tsx outside our app directory and set up the following configuration


Copy
import { cookieStorage, createStorage, http } from '@wagmi/core'
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi'
import { mainnet, arbitrum } from '@reown/appkit/networks'

// Get projectId from https://cloud.reown.com
export const projectId = process.env.NEXT_PUBLIC_PROJECT_ID

if (!projectId) {
  throw new Error('Project ID is not defined')
}

export const networks = [mainnet, arbitrum]

//Set up the Wagmi Adapter (Config)
export const wagmiAdapter = new WagmiAdapter({
  storage: createStorage({
    storage: cookieStorage
  }),
  ssr: true,
  projectId,
  networks
})

export const config = wagmiAdapter.wagmiConfig
​
Importing networks
Reown AppKit use Viem networks under the hood, which provide a wide variety of networks for EVM chains. You can find all the networks supported by Viem within the @reown/appkit/networks path.


Copy
import { createAppKit } from '@reown/appkit'
import { mainnet, arbitrum, base, scroll, polygon } from '@reown/appkit/networks'
Looking to add a custom network? Check out the custom networks section.

​
SSR and Hydration
:::info

Using cookies is completely optional and by default Wagmi will use localStorage instead if the storage param is not defined.
The ssr flag will delay the hydration of Wagmi’s store to avoid hydration mismatch errors.
AppKit doesn’t fully support the ssr flag. :::

​
Context Provider
Let’s create now a context provider that will wrap our application and initialized AppKit (createAppKit needs to be called inside a Next Client Component file).

In this example we will create a file called context/index.tsx outside our app directory and set up the following configuration


Copy
'use client'

import { wagmiAdapter, projectId } from '@/config'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createAppKit } from '@reown/appkit/react'
import { mainnet, arbitrum } from '@reown/appkit/networks'
import React, { type ReactNode } from 'react'
import { cookieToInitialState, WagmiProvider, type Config } from 'wagmi'

// Set up queryClient
const queryClient = new QueryClient()

if (!projectId) {
  throw new Error('Project ID is not defined')
}

// Set up metadata
const metadata = {
  name: 'appkit-example',
  description: 'AppKit Example',
  url: 'https://appkitexampleapp.com', // origin must match your domain & subdomain
  icons: ['https://avatars.githubusercontent.com/u/179229932']
}

// Create the modal
const modal = createAppKit({
  adapters: [wagmiAdapter],
  projectId,
  networks: [mainnet, arbitrum],
  defaultNetwork: mainnet,
  metadata: metadata,
  features: {
    analytics: true // Optional - defaults to your Cloud configuration
  }
})

function ContextProvider({ children, cookies }: { children: ReactNode; cookies: string | null }) {
  const initialState = cookieToInitialState(wagmiAdapter.wagmiConfig as Config, cookies)

  return (
    <WagmiProvider config={wagmiAdapter.wagmiConfig as Config} initialState={initialState}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  )
}

export default ContextProvider
​
Layout
Next, in our app/layout.tsx file, we will import our ContextProvider component and call the Wagmi’s function cookieToInitialState.

The initialState returned by cookieToInitialState, contains the optimistic values that will populate the Wagmi’s store both on the server and client.


Copy
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

import { headers } from 'next/headers' // added
import ContextProvider from '@/context'

export const metadata: Metadata = {
  title: 'AppKit Example App',
  description: 'Powered by Reown'
}

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode
}>) {

  const headersObj = await headers();
  const cookies = headersObj.get('cookie')

  return (
    <html lang="en">
      <body className={inter.className}>
        <ContextProvider cookies={cookies}>{children}</ContextProvider>
      </body>
    </html>
  )
}
​
Trigger the modal
Wagmi
Ethers v5
Ethers
Solana
Bitcoin
To open AppKit you can use our web component or build your own button with AppKit hooks. In this example we are going to use the <appkit-button> component.

Web components are global html elements that don’t require importing.


Copy
export default function ConnectButton() {
  return <appkit-button />
}
Learn more about the AppKit web components here

​
Smart Contract Interaction
Wagmi
Ethers
Solana
Wagmi hooks can help us interact with wallets and smart contracts:


Copy
import { useReadContract } from "wagmi";
import { USDTAbi } from "../abi/USDTAbi";

const USDTAddress = "0x...";

function App() {
  const result = useReadContract({
    abi: USDTAbi,
    address: USDTAddress,
    functionName: "totalSupply",
  });
}
Read more about Wagmi hooks for smart contract interaction here.

​
Extra configuration
Next.js relies on SSR. This means some specific steps are required to make AppKit work properly.

Add the following code in the next.config.js file

Copy
// Path: next.config.js
const nextConfig = {
  webpack: (config) => {
    config.externals.push("pino-pretty", "lokijs", "encoding");
    return config;
  },
};

Hooks

Open in ChatGPT

Hooks are React functions that provide access to wallet connection features, modal controls, blockchain interactions, and wallet event subscriptions. They enable you to manage wallet connections, handle user authentication, interact with smart contracts, and respond to wallet events in your application.

​
Hook Ecosystem
AppKit provides a comprehensive set of React hooks that work together to provide a complete wallet connection and blockchain interaction experience. These hooks can be categorized into several functional groups:

Connection Hooks: Manage wallet connections and user authentication (useAppKit, useAppKitAccount, useDisconnect)
Network Hooks: Handle blockchain network selection and information (useAppKitNetwork)
UI Control Hooks: Control the modal and UI elements (useAppKitState, useAppKitTheme)
Data Access Hooks: Access wallet and blockchain data (useAppKitBalance, useWalletInfo)
Event Hooks: Subscribe to wallet and connection events (useAppKitEvents)
The diagram below illustrates how these hooks relate to each other and to the core AppKit functionality:

AppKit Core

Connection Hooks

Network Hooks

UI Control Hooks

Data Access Hooks

Event Hooks

useAppKit

useAppKitAccount

useDisconnect

useAppKitWallet

useAppKitNetwork

useAppKitState

useAppKitTheme

useWalletInfo

useAppKitBalance

useAppKitEvents

These hooks provide a modular way to integrate wallet functionality into your application, allowing you to use only the features you need.

​
useAppKit
The primary hook for controlling the modal’s visibility and behavior. Use this hook when you need to programmatically open or close the modal, or when you want to show specific views like the connection screen or account details.


Copy
import { useAppKit } from "@reown/appkit/react";

export default function Component() {
  const { open, close } = useAppKit();
}
​
Use Cases
Opening the modal when a user clicks a “Connect Wallet” button
Closing the modal after a successful connection
Opening specific views of the modal (e.g., account view, connect view)
Handling custom wallet connection flows
​
Returns
open: Function to open the modal
close: Function to close the modal
​
Parameters
You can also select the modal’s view when calling the open function


Copy
open({ view: "Account" });

// to connect and show multi wallets view
open({ view: "Connect" });

// to connect and show only solana wallets
open({ view: "Connect", namespace: "solana" });

// to connect and show only bitcoin wallets
open({ view: "Connect", namespace: "bip122" });

// to connect and show only ethereum wallets
open({ view: "Connect", namespace: "eip155" });

// to open swap with arguments
open({
  view: 'Swap',
  arguments: {
    amount: '321.123',
    fromToken: 'USDC',
    toToken: 'ETH'
  }
})
Available namespaces for the Connect view:

Namespace	Description
solana	For connecting to Solana wallets
bip122	For connecting to Bitcoin wallets
eip155	For connecting to Ethereum wallets
List of views you can select:

Variable	Description
Connect	Principal view of the modal - default view when disconnected. A namespace can be selected to connect to a specific network (solana, bip122 or eip155)
Account	User profile - default view when connected
AllWallets	Shows the list of all available wallets
Networks	List of available networks - you can select and target a specific network before connecting
WhatIsANetwork	”What is a network” onboarding view
WhatIsAWallet	”What is a wallet” onboarding view
OnRampProviders	On-Ramp main view
Swap	Swap main view
​
useAppKitAccount
The essential hook for accessing wallet connection state and user information. Use this hook whenever you need to know if a user is connected, get their wallet address, or access their embedded wallet details.


Copy
import { useAppKitAccount } from "@reown/appkit/react";

const { address, isConnected, caipAddress, status, embeddedWalletInfo } =
  useAppKitAccount();
​
Use Cases
Displaying the connected wallet address in your UI
Checking if a user is connected before showing certain features
Getting user information for embedded wallets
Handling multi-chain scenarios where you need account info for specific chains
Related hooks: useAppKitWallet, useDisconnect

Hook for accessing account data and connection status for each namespace when working in a multi-chain environment.


Copy
import { useAppKitAccount } from "@reown/appkit/react";

const eip155Account = useAppKitAccount({ namespace: "eip155" }); // for EVM chains
const solanaAccount = useAppKitAccount({ namespace: "solana" });
const bip122Account = useAppKitAccount({ namespace: "bip122" }); // for bitcoin
​
Returns
allAccounts: A list of connected accounts
address: The current account address
caipAddress: The current account address in CAIP format
isConnected: Boolean that indicates if the user is connected
status: The current connection status
embeddedWalletInfo: The current embedded wallet information

Copy
type EmbeddedWalletInfo {
  user: {
    email?: string | null | undefined
    username?: string | null | undefined
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
​
useAppKitWallet

The direct wallet connection hook that enables connectivity to specific wallets without opening the modal. Use this hook when you want to provide direct wallet buttons, create a customized wallet selection interface, or implement social login options.

Using the wallet button hooks (Demo in our Lab), you can directly connect to the top 20 wallets, WalletConnect QR and also all the social logins. This hook allows to customize dApps, enabling users to connect their wallets effortlessly, all without the need to open the traditional modal. Execute this command to install the library for use it:


npm

Yarn

Bun

pnpm

Copy
npm install @reown/appkit-wallet-button
Then you have to import the hook in your project:


Copy
import { useAppKitWallet } from "@reown/appkit-wallet-button/react";
And finally, you can use the hook in your project:


Copy
const { isReady, isPending, connect } = useAppKitWallet({
    onSuccess(parsedCaipAddress) {
      // Access the parsed CAIP address object
      // See: https://github.com/reown-com/appkit/blob/main/packages/common/src/utils/ParseUtil.ts#L3-L7
      // ...
    },
    onError(error) {
      // ...
    }
  })

...

// Connect to WalletConnect
<Button onClick={() => connect("walletConnect")} />
​
Options for the connect parameter
AppKit supports the top 32 wallets, WalletConnect, social logins, and email authentication:

Type	Options
QR Code	walletConnect
Wallets	metamask, trust, coinbase, rainbow, jupiter, solflare, coin98, magic-eden, backpack, frontier, xverse, okx, bitget, leather, binance, uniswap, safepal, bybit, phantom, ledger, timeless-x, safe, zerion, oneinch, crypto-com, imtoken, kraken, ronin, robinhood, exodus, argent, and tokenpocket
Social logins	google, github, apple, facebook, x, discord, and farcaster
Email	email
​
Use Cases
useAppKitWallet enables:

Direct Wallet Integration

Direct connection to specific wallets (e.g., MetaMask, Coinbase)
Streamlined connection flow without modal
Social Authentication

Social login options (Google, GitHub, etc.)
Email-based authentication
Custom Wallet Selection

Branded wallet selection interface
Custom styling and filtering options
Network-Specific Access

Chain-specific wallet options
Conditional wallet availability
Enhanced UX

Loading states and error handling
Custom notifications
Responsive connection states
​
useAppKitNetwork
The network management hook that provides access to chain information and network switching capabilities. Use this hook when you need to display the current network, switch between networks, or validate network compatibility.


Copy
import { useAppKitNetwork } from "@reown/appkit/react";

export default Component(){
  const { caipNetwork, caipNetworkId, chainId, switchNetwork } = useAppKitNetwork()
}
​
Use Cases
Displaying the current network/chain in your UI
Switching networks when a user selects a different chain
Validating if a user is on the correct network for your dApp
Handling network-specific features or contracts
Related hooks: useAppKitBalance, useWalletInfo

​
Returns
caipNetwork: The current network object
caipNetworkId: The current network id in CAIP format
chainId: The current chain id
switchNetwork: Function to switch the network. Accepts a caipNetwork object as argument.
See how to import or use custom networks here.

​
useAppKitBalance
The balance management hook that provides functions to fetch the native token balance of the connected wallet. Use this hook when you need to display the user’s balance, check if they have sufficient funds for a transaction, or track balance changes.


Copy
import { useAppKitBalance } from "@reown/appkit/react";

function BalanceDisplay() {
  const { fetchBalance } = useAppKitBalance();
  const [balance, setBalance] = useState();
  const { isConnected } = useAppKitAccount();
  
  useEffect(() => {
    if (isConnected) {
      fetchBalance().then(setBalance);
    }
  }, [isConnected, fetchBalance]);

  return (
    <div>
      {balance && (
        <p>Balance: {balance.data?.formatted} {balance.data?.symbol}</p>
      )}
    </div>
  );
}
​
Use Cases
Displaying the user’s wallet balance in your UI
Checking if a user has sufficient funds before initiating a transaction
Monitoring balance changes after transactions
Implementing balance-based features or UIs
Related hooks: useAppKitAccount, useAppKitNetwork

​
Returns
fetchBalance: Async function that returns the current balance of the connected wallet

Copy
type BalanceResult = {
  data?: {
    formatted: string;
    symbol: string;
  };
  error: string | null;
  isSuccess: boolean;
  isError: boolean;
}
​
useAppKitState
The state management hook that provides real-time access to the modal’s current state. Use this hook when you need to react to modal state changes or synchronize your UI with the modal’s status.


Copy
import { useAppKitState } from "@reown/appkit/react";

const { open, selectedNetworkId } = useAppKitState();
​
Use Cases
Syncing your UI with the modal’s open/closed state
Tracking which network the user has selected
Creating custom UI elements that respond to modal state changes
Implementing custom loading states based on modal state
​
Returns
open: Boolean that indicates if the modal is open
selectedNetworkId: The current chain id selected by the user
​
useAppKitTheme
The theming hook that controls the visual appearance of the modal. Use this hook when you need to customize the modal’s colors, implement dark/light mode, or match the modal’s appearance with your application’s theme.


Copy
import { useAppKitTheme } from "@reown/appkit/react";
const { themeMode, themeVariables, setThemeMode, setThemeVariables } =
  useAppKitTheme();

setThemeMode("dark");

setThemeVariables({
  "--w3m-color-mix": "#00BB7F",
  "--w3m-color-mix-strength": 40,
});
​
Use Cases
Implementing dark/light mode in your dApp
Customizing the modal’s appearance to match your brand
Creating theme-specific UI elements
Syncing the modal’s theme with your app’s theme
​
useAppKitEvents
The event subscription hook that allows you to listen to modal and wallet events. Use this hook when you need to track user interactions, implement analytics, or respond to specific wallet events in your application.


Copy
import { useAppKitEvents } from "@reown/appkit/react";

const events = useAppKitEvents();
​
Use Cases
Tracking user interactions with the modal
Implementing analytics for wallet connections
Creating custom notifications for connection events
Handling specific wallet events in your application
​
useDisconnect
The session management hook that handles wallet disconnection. Use this hook when implementing logout functionality or when you need to clean up resources after a user disconnects their wallet.


Copy
import { useDisconnect } from "@reown/appkit/react";

const { disconnect } = useDisconnect();

await disconnect();
​
Use Cases
Implementing a “Disconnect Wallet” button
Handling logout flows in your application
Cleaning up resources when a user disconnects
Resetting application state after disconnection
​
useWalletInfo
Hook for accessing wallet information.


Copy
import { useWalletInfo } from '@reown/appkit/react'


function WalletDisplay() {
  const { walletInfo } = useWalletInfo();
  
  return (
    <div className="wallet-info">
      {walletInfo?.name && (
        <>
          <img src={walletInfo.icon} alt={walletInfo.name} />
          <span>{walletInfo.name}</span>
        </>
      )}
    </div>
  );
}
​
Use Cases
Displaying wallet-specific information in your UI
Implementing wallet-specific features
Showing wallet icons or branding
Handling wallet-specific behaviors
​
Ethereum/Solana Library
Wagmi
Ethers
Ethers v5
Solana
​
useAppKitAccount
Hook that returns the client’s information.


Copy
import { useAppKitAccount } from "@reown/appkit/react";

function Components() {
  const { address, caipAddress, isConnected } = useAppKitAccount();

  //...
}
​
useSignMessage
Hook for signing messages with connected account.


Copy
import { useSignMessage } from "wagmi";

function App() {
  const { signMessage } = useSignMessage();

  return (
    <button onClick={() => signMessage({ message: "hello world" })}>
      Sign message
    </button>
  );
}
Learn More
Was this page helpful?




Options

Open in ChatGPT

The following options can be passed to the createAppKit function:


Copy
createAppKit({ adapters, projectId, networks, ...options });
​
networks
Array of networks that can be chosen from the @reown/appkit/networks library. This library retrieves the list of EVM networks from Viem and also includes the Solana networks.


Copy
import { mainnet, solana } from "@reown/appkit/networks";

createAppKit({
  // ...
  networks: [mainnet, solana],
});
For custom networks, refer to this doc page.

​
metadata
Metadata for your AppKit. The name, description, icons, and url are used at certain places like the wallet connection, sign message, etc screens. If not provided, they will be fetched from the metadata of your website’s document object.


Copy
createAppKit({
  // ...
  metadata: {
    name: "My App",
    description: "My App Description",
    icons: ["https://myapp.com/icon.png"],
    url: "https://myapp.com",
  },
});
For custom networks, refer to this doc page.

​
defaultNetwork
Desired network for the initial connection as default:

Wagmi
Ethers
Solana

Copy
import { mainnet } from "@reown/appkit/networks";

createAppKit({
  //...
  defaultNetwork: mainnet,
});
​
defaultAccountTypes
It allows you to configure the default account selected for the specified networks in AppKit. For example, if you want your EVM networks to use an EOA account by default, you can configure it as shown in the code below.


Copy
createAppKit({
  //...
  defaultAccountTypes: { eip155: "eoa" },
});
Here are all the options you have for each network identifier or networks. Network identifier or networks available are eip155 for EVM chains, solana for Solana, bip122 for Bitcoin, and polkadot for Polkadot.


Copy
type DefaultAccountTypes = {
  eip155: "eoa" | "smartAccount";
  solana: "eoa";
  bip122: "payment" | "ordinal" | "stx";
  polkadot: "eoa";
};
​
featuredWalletIds
Select wallets that are going to be shown on the modal’s main view. Default wallets are MetaMask and Trust Wallet. Array of wallet ids defined will be prioritized (order is respected). These wallets will also show up first in All Wallets view. You can find the wallets IDs in Wallets List or in WalletGuide


Copy
createAppKit({
  //...
  featuredWalletIds: [
    "1ae92b26df02f0abca6304df07debccd18262fdf5fe82daa81593582dac9a369",
    "4622a2b2d6af1c9844944291e5e7351a6aa24cd7b23099efac1b2fd875da31a0",
  ],
});
​
chainImages
Add or override the modal’s network images.


Copy
createAppKit({
  // ...
  chainImages: {
    1: "https://my.images.com/eth.png",
  },
});
​
connectorImages
Wagmi
Ethers
Solana
Set or override the images of any connector. The key of each property must match the id of the connector.


Copy
createAppKit({
  connectorImages: {
    coinbaseWallet: "https://images.mydapp.com/coinbase.png",
    metaMask: "https://images.mydapp.com/metamask.png",
  },
});
​
enableWalletConnect
Enable or disable WalletConnect QR feature. Default is true.


Copy
enableWalletConnect: false;
​
enableNetworkSwitch
Enables or disables the network switching functionality in the modal. The default is true.


Copy
createAppKit({
  //...
  enableNetworkSwitch: false,
});
​
debug
Enable or disable debug mode in your AppKit. This is useful if you want to see UI alerts when debugging. Default is false.


Copy
debug: true;
​
enableWalletGuide
Enable or disable the wallet guide text, is useful for people that don’t have a wallet yet. Default is true.


Copy
createAppKit({
  //...
  enableWalletGuide: false,
});
​
termsConditionsUrl
You can add an url for the terms and conditions link.


Copy
createAppKit({
  //...
  termsConditionsUrl: "https://www.mytermsandconditions.com",
});
​
privacyPolicyUrl
A URL for the privacy policy link.


Copy
createAppKit({
  //...
  privacyPolicyUrl: "https://www.myprivacypolicy.com",
});
​
features
Allows you to toggle (enable or disable) additional features provided by AppKit. Features such as analytics, email and social logins, On-ramp, swaps, etc., can be enabled using this parameter.

​
analytics
Enable analytics to get more insights on your users activity within your Reown Cloud’s dashboard


Copy
createAppKit({
  //...
  features: {
    analytics: true,
  },
});
Learn More
​
swaps
Enable or disable the swap feature in your AppKit. Swaps feature is enabled by default.


Copy
createAppKit({
  //...
  features: {
    swaps: true,
  },
});
​
onramp
Enable or disable the onramp feature in your AppKit. Onramp feature is enabled by default.


Copy
createAppKit({
  //...
  features: {
    onramp: true,
  },
});
​
connectMethodsOrder
Order of the connection methods in the modal. The default order is ['wallet', 'email', 'social'].



Copy
createAppKit({
  //...
  features: {
    connectMethodsOrder: ["social", "email", "wallet"],
  },
});
​
legalCheckbox
Enable or disable the terms of service and/or privacy policy checkbox.


Copy
createAppKit({
  //...
  features: {
    legalCheckbox: true,
  },
});

​
customWallets
Adds custom wallets to the modal. customWallets is an array of objects, where each object contains specific information of a custom wallet.


Copy
createAppKit({
  //...
  customWallets: [
    {
      id: "myCustomWallet",
      name: "My Custom Wallet",
      homepage: "www.mycustomwallet.com", // Optional
      image_url: "my_custom_wallet_image", // Optional
      mobile_link: "mobile_link", // Optional - Deeplink or universal
      desktop_link: "desktop_link", // Optional - Deeplink
      webapp_link: "webapp_link", // Optional
      app_store: "app_store", // Optional
      play_store: "play_store", // Optional
    },
  ],
});
​
AllWallets
If the “All Wallets” button is removed on mobile, all the mobile wallets that were not added on the main view of the modal won’t be able to connect to your website via WalletConnect protocol.

The allWallets parameter allows you to add or remove the “All Wallets” button on the modal.

Value	Description
SHOW	Shows the “All Wallets” button on AppKit.
HIDE	Removes the “All Wallets” button from AppKit.
ONLY_MOBILE	Shows the “All Wallets” button on AppKit only on mobile.

Copy
createAppKit({
  //...
  allWallets: "ONLY_MOBILE",
});
​
includeWalletIds & excludeWalletIds
Wallets that are either not included or excluded won’t be able to connect to your website on mobile via WalletConnect protocol.

​
includeWalletIds
Override default recommended wallets that are fetched from WalletGuide. Array of wallet ids defined will be shown (order is respected). Unlike featuredWalletIds, these wallets will be the only ones shown in All Wallets view and as recommended wallets. You can find the wallets IDs in our Wallets List.


Copy
createAppKit({
  //...
  includeWalletIds: [
    "1ae92b26df02f0abca6304df07debccd18262fdf5fe82daa81593582dac9a369",
    "4622a2b2d6af1c9844944291e5e7351a6aa24cd7b23099efac1b2fd875da31a0",
  ],
});
​
excludeWalletIds
Exclude wallets that are fetched from WalletGuide. Array of wallet ids defined will be excluded. All other wallets will be shown in respective places. You can find the wallets IDs in our Wallets List.


Copy
createAppKit({
  //...
  excludeWalletIds: [
    "1ae92b26df02f0abca6304df07debccd18262fdf5fe82daa81593582dac9a369",
    "4622a2b2d6af1c9844944291e5e7351a6aa24cd7b23099efac1b2fd875da31a0",
  ],
});
​
Coinbase Smart Wallet
The Coinbase connector now includes a new flag to customize the Smart Wallet behavior.

To enable the Coinbase Smart Wallet feature, ensure that AppKit is updated to version 4.2.3 or higher. Additionally, if you are using Wagmi, verify that it is on the latest version.

The preference (or coinbasePreference) flag accepts one of the following string values:

eoaOnly: Uses EOA Browser Extension or Mobile Coinbase Wallet.
smartWalletOnly: Displays Smart Wallet popup.
all (default): Supports both eoaOnly and smartWalletOnly based on context.
Wagmi
Ethers
AppKit can be configured in two different ways: Default or Custom

Select your preferred configuration mode below:

Learn more about the Coinbase connector in the Wagmi documentation.


Default

Custom

Copy
createAppKit({
  //...
  enableCoinbase: true, // true by default
  coinbasePreference: "smartWalletOnly",
});
​
customRpcUrls
This function allows you to add custom RPC URLs to override the default network RPC URLs for native RPC calls. This is useful when you want to use your own RPC endpoints instead of the defaults.


Copy
type CustomRpcUrl = {
  url: string
  config?: HttpTransportConfig // Optional transport configuration
}

type CustomRpcUrlMap = Record<CaipNetworkId, CustomRpcUrl[]>

createAppKit({
  //...
  customRpcUrls: {
    'eip155:1': [
      {
        url: 'https://your-custom-mainnet-url.com',
        config: {
          // Optional HTTP transport configuration
        }
      }
    ],
    'eip155:137': [
      {
        url: 'https://your-custom-polygon-url.com'
      }
    ]
  }
})
If you are using the Wagmi adapter, you need to pass the same customRpcUrls configuration to both the WagmiAdapter and createAppKit.


Copy
const customRpcUrls: CustomRpcUrlMap = {
  'eip155:1': [{ url: 'https://your-custom-mainnet-url.com' }],
  'eip155:137': [{ url: 'https://your-custom-polygon-url.com' }]
}

const wagmiAdapter = new WagmiAdapter({
  networks: [...],
  projectId: "project-id",
  customRpcUrls
})

const modal = createAppKit({
  adapters: [...],
  networks: [...],
  projectId: "project-id",
  customRpcUrls
})
When using the Wagmi adapter, you don’t need to configure transports separately. The WagmiAdapter will automatically configure them based on your customRpcUrls.

However, if you use both customRpcUrls and Wagmi’s transports property, be aware that transports will take precedence and override any conflicting RPC URLs defined in customRpcUrls.


Copy
const wagmiAdapter = new WagmiAdapter({
  //...
  customRpcUrls: {
    'eip155:1': [{ url: 'https://custom-rpc-1.com' }] // This will be overridden
  },
  transports: {
    [mainnet.id]: http('https://transport-rpc-1.com') // This takes precedence
  }
})
​
universalProviderConfigOverride
Lets you customize specific aspects of the provider’s behavior.


Copy
createAppKit({
  //...
  universalProviderConfigOverride: {
    methods: { eip155: ['eth_sendTransaction', 'personal_sign'] },
    chains: { eip155: ['1', '137'] },
    events: { eip155: ['chainChanged', 'accountsChanged'] },
    rpcMap: { eip155:1: 'https://ethereum.publicnode.com' },
    defaultChain: 'eip155:1'
  },
});
You can override any of the following properties:

methods: Custom RPC methods for each namespace
chains: Supported chains for each namespace
events: Events to subscribe to for each namespace
rpcMap: Custom RPC URLs for specific chains
defaultChain: The default chain to connect to
Was this page helpful?



Web Components

Open in ChatGPT

AppKit’s web components are custom and reusable HTML tags. They will work across modern browsers, and can be used with any JavaScript library or framework that works with HTML.

Web components are global html elements that don’t require importing.

​
List of optional properties for AppKit web components
​
<appkit-button />
Variable	Description	Type
disabled	Enable or disable the button.	boolean
balance	Show or hide the user’s balance.	'show' | 'hide'
size	Default size for the button.	'md' | 'sm'
label	The text shown in the button.	string
loadingLabel	The text shown in the button when the modal is open.	string
namespace	Option to show specific namespace account info. Note: eip155 is for EVM and bip122 is for Bitcoin.	'eip155' | 'solana' | 'bip122'
​
<appkit-account-button />
Variable	Description	Type
disabled	Enable or disable the button.	boolean
balance	Show or hide the user’s balance.	'show' | 'hide'
​
<appkit-connect-button />
Variable	Description	Type
size	Default size for the button.	'md' | 'sm'
label	The text shown in the button.	string
loadingLabel	The text shown in the button when the modal is open.	string
​
<appkit-network-button />
Variable	Description	Type
disabled	Enable or disable the button.	boolean
​
<appkit-wallet-button  />

Using the wallet button components (Demo in our Lab), you can directly connect to the top 20 wallets, WalletConnect QR and also all the social logins. This component allows to customize dApps, enabling users to connect their wallets effortlessly, all without the need for the traditional modal.

Follow these steps to use the component:

Install the package:

npm

Yarn

Bun

pnpm

Copy
npm install @reown/appkit-wallet-button
Import the library in your project:

Copy
import "@reown/appkit-wallet-button/react";
use the component in your project:

Copy
<appkit-wallet-button wallet="metamask" />
​
Options for wallet property
Type	Options
QR Code	walletConnect
Wallets	metamask, trust, coinbase, rainbow, coinbase, jupiter, solflare, coin98, magic-eden, backpack, frontier, xverse, okx, bitget, leather, binance, uniswap, safepal, bybit, phantom, ledger, timeless-x, safe, zerion, oneinch, crypto-com, imtoken, kraken, ronin, robinhood, exodus, argent, and tokenpocket
Social logins	google, github, apple, facebook, x, discord, and farcaster
Was this page helpful?


Y
Custom connectors

Open in ChatGPT

In AppKit, a ‘connector’ is the bridge between your app and a user’s wallet. This page shows how to add custom connectors beyond the default ones, allowing your users to connect with additional wallet types and authentication methods.

Wagmi
If you already have Wagmi integrated into your application or would like more control over Wagmi’s configuration, you can integrate AppKit on top of it.

Adding custom connectors like WalletConnect and Coinbase is optional.

By default, EIP-6963 and WC connectors are provided out of the box.


Copy
import { createAppKit } from '@reown/appkit/react'
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi'

import { http, WagmiProvider, CreateConnectorFn } from 'wagmi'
import { abstractTestnet } from '@reown/appkit/networks'
// you need to add the abstract library in order to make it work
import { abstractWalletConnector } from "@abstract-foundation/agw-react/connectors";
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const queryClient = new QueryClient()

export const projectId = process.env.NEXT_PUBLIC_PROJECT_ID

const metadata = {
  //...
}

// create the custom connector (in this example Abastract)
const connectors: CreateConnectorFn[] = []
connectors.push(abstractWalletConnector())

export const networks = [abstractTestnet]

export const wagmiAdapter = new WagmiAdapter({
  connectors,
  projectId,
  networks
})

export const config = wagmiAdapter.wagmiConfig

createAppKit({
  adapters: [wagmiAdapter],
  projectId,
  networks
})

export function ContextProvider({ children }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  )
}
Check our Next.js Wagmi demo in Github

Was this page helpful?


Custom networks

Open in ChatGPT

If you cannot find the network you are looking for within the @reown/appkit/networks path, you can always add a custom network.

Since AppKit v1.1.0, there are two ways to add your network to AppKit:

​
1. Adding Your Chain to Viem’s Directory (Recommended)
Reown AppKit use Viem to provide EVM chains to users under the hood. If your chain is EVM-compatible, it is recommended to open a PR to Viem to add your network to Viem’s directory. Once your chain is accepted by Viem, it will automatically be available in AppKit with no additional steps required.

Here is the documentation of how to add new chain to Viem: https://github.com/wevm/viem/blob/main/.github/CONTRIBUTING.md#chains

​
2. Creating a Custom Chain Object
You can also create a custom network object without waiting for approval from Viem’s repository.

Required Information

You will need the following values to create a custom network:

id: Chain ID of the network.
name: Name of the network.
caipNetworkId: CAIP-2 compliant network ID.
chainNamespace: Chain namespace.
nativeCurrency: Native currency of the network.
rpcUrls: Object containing the RPC URLs for the network.
blockExplorers: Object containing the block explorers for the network.

Copy
import { defineChain } from '@reown/appkit/networks';

// Define the custom network
const customNetwork = defineChain({
  id: 123456789,
  caipNetworkId: 'eip155:123456789',
  chainNamespace: 'eip155',
  name: 'Custom Network',
  nativeCurrency: {
    decimals: 18,
    name: 'Ether',
    symbol: 'ETH',
  },
  rpcUrls: {
    default: {
      http: ['RPC_URL'],
      webSocket: ['WS_RPC_URL'],
    },
  },
  blockExplorers: {
    default: { name: 'Explorer', url: 'BLOCK_EXPLORER_URL' },
  },
  contracts: {
    // Add the contracts here
  }
})

// Then pass it to the AppKit
createAppKit({
    adapters: [...],
    networks: [customNetwork],
    chainImages: { // Customize networks' logos
      123456789: '/custom-network-logo.png', // <chainId>: 'www.network.com/logo.png'
    }
})
Was this page helpful?


Yes

No
Suggest edits
Raise issue
Custom connectors
One-Click Auth / SIWE
website
x
discord
linkedin
github
youtubeMultichain

Open in ChatGPT

AppKit is now multichain. The architecture is designed to support both EVM and non-EVM blockchains. This will allow developers and projects to choose and configure multiple blockchain networks within their instance of AppKit, extending beyond just Ethereum-based (EVM) networks.

Currently, AppKit supports two non-EVM networks, they are, Solana and Bitcoin.

​
Installation
Wagmi + Solana
Wagmi + Bitcoin
Ethers5 + Solana
Ethers + Solana
Core

npm

Yarn

Bun

pnpm

Copy
npm install @reown/appkit @reown/appkit-adapter-wagmi @reown/appkit-adapter-solana
​
Integration
The AppKit instance allows you to support multiple chains by importing the respective chains, creating the respective network adapters and passing these within the createAppKit() function.

Depending on the network adapter of your preference (Wagmi, Ethers, Ethers5), the integration may vary. Let’s look at what the integration will look like.

Wagmi + Solana
Wagmi + Bitcoin
Ethers + Solana
Ethers5 + Solana
Core

Copy
import { createAppKit } from '@reown/appkit'
import { SolanaAdapter } from '@reown/appkit-adapter-solana'
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi'

import {
  mainnet,
  arbitrum,
  sepolia,
  solana,
  solanaTestnet,
  solanaDevnet,
} from "@reown/appkit/networks";
import type { AppKitNetwork } from "@reown/appkit/types";

const networks: [AppKitNetwork, ...AppKitNetwork[]] = [mainnet, arbitrum, sepolia, solana, solanaTestnet, solanaDevnet]

// 0. Get projectId from https://cloud.reown.com
const projectId = 'YOUR_PROJECT_ID'

// 1. Create the Wagmi adapter
export const wagmiAdapter = new WagmiAdapter({
  ssr: true,
  projectId,
  networks
})

// 2. Create Solana adapter
const solanaWeb3JsAdapter = new SolanaAdapter()

// 3. Set up the metadata - Optional
const metadata = {
  name: 'AppKit',
  description: 'AppKit Example',
  url: 'https://example.com', // origin must match your domain & subdomain
  icons: ['https://avatars.githubusercontent.com/u/179229932']
}

// 4. Create the AppKit instance
const modal = createAppKit({
  adapters: [wagmiAdapter, solanaWeb3JsAdapter],
  networks,
  metadata,
  projectId,
  features: {
    analytics: true,
  }
})
Was this page helpful?


Yes

No
Suggest edits
Raise issue
SIWX
Theming
website
x
discord
linkedin
github
youtube
Theming

Open in ChatGPT

The theme for the AppKit integration in your dApp can be fully customized.

​
ThemeMode
By default themeMode option will be set to user system settings ‘light’ or ‘dark’. But you can override it like this:


Copy
createAppKit({
  //...
  themeMode: "light",
});
​
themeVariables
By default themeVariables are undefined. You can set them like this:


Copy
createAppKit({
  //...
  themeVariables: {
    "--w3m-color-mix": "#00BB7F",
    "--w3m-color-mix-strength": 40,
  },
});
The following list shows the theme variables you can override:

Variable	Description	Type
--w3m-font-family	Base font family	string
--w3m-accent	Color used for buttons, icons, labels, etc.	string
--w3m-color-mix	The color that blends in with the default colors	string
--w3m-color-mix-strength	The percentage on how much “—w3m-color-mix” should blend in	number
--w3m-font-size-master	The base pixel size for fonts.	string
--w3m-border-radius-master	The base border radius in pixels.	string
--w3m-z-index	The z-index of the modal.	number
​
Wallet Buttons
Wallet buttons are components that allow users to connect their wallets to your dApp. They provide a simple and easy way to connect to the top 20 wallets, WalletConnect QR, and all the social logins. You can also call them directly using hooks. Please check the components and hooks documentation for more information.




Try Wallet Buttons
Was this page helpful?


Yes

No
Suggest edits
Raise issue
Multichain
Resources
website
x
discord
linkedin
github
youtube