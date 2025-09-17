# n8n-nodes-tg-bot-constructor

This is an n8n community node. It lets you easily create Telegram bots in your n8n workflows.

This is a chain node that is convenient for creating Telegram bots with a multi-level menu.

[n8n](https://n8n.io/) is a [fair-code licensed](https://docs.n8n.io/reference/license/) workflow automation platform.

[Installation](#installation)  
[Operations](#operations)  
[Credentials](#credentials)  <!-- delete if no auth needed -->  
[Compatibility](#compatibility)  
[Usage](#usage)  <!-- delete if not using this section -->  
[Resources](#resources)  
[Version history](#version-history)  <!-- delete if not using this section -->  

## Installation

Follow the [installation guide](https://docs.n8n.io/integrations/community-nodes/installation/) in the n8n community nodes documentation. Or you can download source code, manually build it by running `npm run build` command and then copy `dist` directory, `package.json` and `index.js` files to `n8n-data/nodes/node_modules/n8n-nodes-tg-bot-construcor`.

## Operations

There is only one operation  `Send message` to which you can add various options.

## Credentials

Basic Telegram credentials. Detailed guide [here](https://docs.n8n.io/integrations/builtin/credentials/telegram/)

## Compatibility

Developed under n8n version 1.108.2. Other versions were not tested by now.

## Usage

This node can be used in a chain to create multi-level menu structures. If you want to integrate other processes into the chain you should remember to provide output of previous link to the next (Merge node can help with that).

## Resources

* [n8n community nodes documentation](https://docs.n8n.io/integrations/#community-nodes)
