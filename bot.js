const { Client, GatewayIntentBits, Events } = require('discord.js');
const Chart = require('chart.js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] });
const positions = {};
const hideClosedStatus = new Set(); // To manage hiding closed statuses
const positionsFilePath = path.join(__dirname, 'positions.json');

// Load positions from JSON file
function loadPositions() {
    if (fs.existsSync(positionsFilePath)) {
        const data = fs.readFileSync(positionsFilePath);
        return JSON.parse(data);
    }
    return {};
}

// Save positions to JSON file
function savePositions(data) {
    fs.writeFileSync(positionsFilePath, JSON.stringify(data, null, 2));
}

// Create a live portfolio embed
async function createLivePortfolioEmbed(expertName) {
    const embed = {
        title: `Portfolio Overview for ${expertName}`,
        fields: [],
        color: 0x0099ff,
    };

    const data = Object.entries(positions[expertName] || {});
    if (data.length === 0) {
        embed.fields.push({ name: 'No positions', value: 'No active positions found.' });
    } else {
        for (const [ticker, position] of data) {
            embed.fields.push({
                name: `${ticker}`,
                value: `Entry Price: ${position.entryPrice}\n` +
                       `Stop Loss: ${position.stopLoss}\n` +
                       `Amount: ${position.amount}\n` +
                       `Closed Price: ${position.closedPrice || 'Open'}`,
                inline: true,
            });
        }
    }

    return embed;
}

// Helper function to validate position parameters
function validatePositionParameters(entryPrice, stopLoss, takeProfit) {
    if (stopLoss >= entryPrice) {
        throw new Error('Stop loss must be less than entry price.');
    }
    if (takeProfit <= entryPrice) {
        throw new Error('Take profit must be greater than entry price.');
    }
}

// Clear all positions for an expert
async function clearAllPositions(expertName) {
    if (positions[expertName]) {
        delete positions[expertName]; // Clear all positions
        savePositions(positions);
    }
}

// Interaction handler for slash commands
client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const { commandName, options, guild, channel, user } = interaction;

    // Log the interaction for debugging
    console.log(`Received command: ${commandName} from ${user.tag}`);

    // Ignore interactions outside of guilds
    if (!guild) {
        await interaction.reply({ content: 'This command can only be used within a server.', ephemeral: true });
        return;
    }

    // Determine the expert name based on the channel's parent category
    const channelParent = channel.parent;
    if (!channelParent) {
        await interaction.reply({ content: "This channel is not under a category.", ephemeral: true });
        return;
    }

    const expertName = channelParent.name; // Get expert name
    const entriesChannel = channelParent.children.cache.find(ch => ch.name === 'entries-and-exits' && ch.type === 0);
    if (!entriesChannel) {
        await interaction.reply({ content: `The 'entries-and-exits' channel does not exist for **${expertName}**.`, ephemeral: true });
        return;
    }

    try {
        // Defer the reply to give the bot more time to process
        await interaction.deferReply({ ephemeral: false });

        if (commandName === 'long-position') {
            const tickerName = options.getString('ticker').toUpperCase();
            const entryPrice = options.getNumber('entry-price');
            const stopLoss = options.getNumber('stop-loss');
            const amount = options.getInteger('amount');

            // Validate inputs
            if (!tickerName || isNaN(entryPrice) || isNaN(stopLoss) || isNaN(amount)) {
                await interaction.editReply('❌ Please provide valid ticker symbol, entry price, stop loss, and amount of shares.');
                return;
            }

            // Validate stop loss
            validatePositionParameters(entryPrice, stopLoss, entryPrice); // Ensure valid parameters

            // Update position
            positions[expertName] = positions[expertName] || {};
            positions[expertName][tickerName] = {
                entryPrice: parseFloat(entryPrice),
                closedPrice: null,
                stopLoss: parseFloat(stopLoss),
                amount: parseInt(amount),
            };
            savePositions(positions);

            const embed = await createLivePortfolioEmbed(expertName);
            await entriesChannel.send({ embeds: [embed] });

            await interaction.editReply(`📈 Long position for **${tickerName}** added in **${entriesChannel}**.`);
        }

        else if (commandName === 'close-long-position') {
            const tickerName = options.getString('ticker').toUpperCase();
            const exitPrice = options.getNumber('exit-price');
            const amount = options.getInteger('amount');

            // Validate inputs
            if (!tickerName || isNaN(exitPrice) || isNaN(amount)) {
                await interaction.editReply('❌ Please provide valid ticker symbol, exit price, and amount of shares to close.');
                return;
            }

            const positionData = positions[expertName]?.[tickerName];

            if (!positionData) {
                await interaction.editReply(`❌ No open position found for **${tickerName}**.`);
                return;
            }

            const totalSold = Math.min(positionData.amount, parseInt(amount));
            positionData.closedPrice = parseFloat(exitPrice);
            positionData.amount -= totalSold;

            if (positionData.amount === 0) {
                delete positions[expertName][tickerName]; // Remove position if all shares are sold
            }
            savePositions(positions);

            const embed = await createLivePortfolioEmbed(expertName);
            await entriesChannel.send({ embeds: [embed] });

            await interaction.editReply(`✅ Closed long position for **${tickerName}** in **${entriesChannel}**.`);
            
            // Schedule to hide the closed status after 2 minutes
            const positionKey = `${expertName}-${tickerName}`;
            setTimeout(async () => {
                hideClosedStatus.add(positionKey);
                const embed = await createLivePortfolioEmbed(expertName);
                await entriesChannel.send({ embeds: [embed] });
                hideClosedStatus.delete(positionKey);
            }, 120000); // 2 minutes in milliseconds
        }

        else if (commandName === 'gambler-position') {
            const tickerName = options.getString('ticker').toUpperCase();
            const entryPrice = options.getNumber('entry-price');
            const stopLoss = options.getNumber('stop-loss');
            const takeProfit = options.getNumber('take-profit');
            const amount = options.getInteger('amount');

            // Validate inputs
            if (!tickerName || isNaN(entryPrice) || isNaN(stopLoss) || isNaN(takeProfit) || isNaN(amount)) {
                await interaction.editReply('❌ Please provide valid ticker symbol, entry price, stop loss, take profit, and amount of shares.');
                return;
            }

            // Validate stop loss and take profit
            validatePositionParameters(entryPrice, stopLoss, takeProfit);

            // Update position
            positions[expertName] = positions[expertName] || {};
            positions[expertName][tickerName] = {
                entryPrice: parseFloat(entryPrice),
                closedPrice: null,
                stopLoss: parseFloat(stopLoss),
                takeProfit: parseFloat(takeProfit),
                amount: parseInt(amount),
            };
            savePositions(positions);

            const embed = await createLivePortfolioEmbed(expertName);
            await entriesChannel.send({ embeds: [embed] });

            await interaction.editReply(`🎲 Gambler position for **${tickerName}** added in **${entriesChannel}**.`);
        }

        else if (commandName === 'close-gambler-position') {
            const tickerName = options.getString('ticker').toUpperCase();
            const exitPrice = options.getNumber('exit-price');
            const amount = options.getInteger('amount');

            // Validate inputs
            if (!tickerName || isNaN(exitPrice) || isNaN(amount)) {
                await interaction.editReply('❌ Please provide valid ticker symbol, exit price, and amount of shares to close.');
                return;
            }

            const positionData = positions[expertName]?.[tickerName];

            if (!positionData) {
                await interaction.editReply(`❌ No open position found for **${tickerName}**.`);
                return;
            }

            const totalSold = Math.min(positionData.amount, parseInt(amount));
            positionData.closedPrice = parseFloat(exitPrice);
            positionData.amount -= totalSold;

            if (positionData.amount === 0) {
                delete positions[expertName][tickerName]; // Remove position if all shares are sold
            }
            savePositions(positions);

            const embed = await createLivePortfolioEmbed(expertName);
            await entriesChannel.send({ embeds: [embed] });

            await interaction.editReply(`✅ Closed gambler position for **${tickerName}** in **${entriesChannel}**.`);
            
            // Schedule to hide the closed status after 2 minutes
            const positionKey = `${expertName}-${tickerName}`;
            setTimeout(async () => {
                hideClosedStatus.add(positionKey);
                const embed = await createLivePortfolioEmbed(expertName);
                await entriesChannel.send({ embeds: [embed] });
                hideClosedStatus.delete(positionKey);
            }, 120000); // 2 minutes in milliseconds
        }

        else if (commandName === 'swing-position') {
            const tickerName = options.getString('ticker').toUpperCase();
            const entryPrice = options.getNumber('entry-price');
            const stopLoss = options.getNumber('stop-loss');
            const takeProfit = options.getNumber('take-profit');
            const amount = options.getInteger('amount');

            // Validate inputs
            if (!tickerName || isNaN(entryPrice) || isNaN(stopLoss) || isNaN(takeProfit) || isNaN(amount)) {
                await interaction.editReply('❌ Please provide valid ticker symbol, entry price, stop loss, take profit, and amount of shares.');
                return;
            }

            // Validate stop loss and take profit
            validatePositionParameters(entryPrice, stopLoss, takeProfit);

            // Update position
            positions[expertName] = positions[expertName] || {};
            positions[expertName][tickerName] = {
                entryPrice: parseFloat(entryPrice),
                closedPrice: null,
                stopLoss: parseFloat(stopLoss),
                takeProfit: parseFloat(takeProfit),
                amount: parseInt(amount),
            };
            savePositions(positions);

            const embed = await createLivePortfolioEmbed(expertName);
            await entriesChannel.send({ embeds: [embed] });

            await interaction.editReply(`🔄 Swing position for **${tickerName}** added in **${entriesChannel}**.`);
        }

        else if (commandName === 'close-swing-position') {
            const tickerName = options.getString('ticker').toUpperCase();
            const exitPrice = options.getNumber('exit-price');
            const amount = options.getInteger('amount');

            // Validate inputs
            if (!tickerName || isNaN(exitPrice) || isNaN(amount)) {
                await interaction.editReply('❌ Please provide valid ticker symbol, exit price, and amount of shares to close.');
                return;
            }

            const positionData = positions[expertName]?.[tickerName];

            if (!positionData) {
                await interaction.editReply(`❌ No open position found for **${tickerName}**.`);
                return;
            }

            const totalSold = Math.min(positionData.amount, parseInt(amount));
            positionData.closedPrice = parseFloat(exitPrice);
            positionData.amount -= totalSold;

            if (positionData.amount === 0) {
                delete positions[expertName][tickerName]; // Remove position if all shares are sold
            }
            savePositions(positions);

            const embed = await createLivePortfolioEmbed(expertName);
            await entriesChannel.send({ embeds: [embed] });

            await interaction.editReply(`✅ Closed swing position for **${tickerName}** in **${entriesChannel}**.`);
            
            // Schedule to hide the closed status after 2 minutes
            const positionKey = `${expertName}-${tickerName}`;
            setTimeout(async () => {
                hideClosedStatus.add(positionKey);
                const embed = await createLivePortfolioEmbed(expertName);
                await entriesChannel.send({ embeds: [embed] });
                hideClosedStatus.delete(positionKey);
            }, 120000); // 2 minutes in milliseconds
        }

        else if (commandName === 'clear-positions') {
            clearAllPositions(expertName);
            await interaction.editReply(`🗑️ All positions cleared for **${expertName}**.`);
        }

        else if (commandName === 'bull-market') {
            const action = options.getString('action');
            const tickerName = options.getString('ticker').toUpperCase();
            const entryPrice = options.getNumber('entry-price');
            const stopLoss = options.getNumber('stop-loss');
            const takeProfit = options.getNumber('take-profit');
            const amount = options.getInteger('amount');

            // Validate inputs
            if (!action || !['set', 'close'].includes(action)) {
                await interaction.editReply('❌ Invalid action. Please specify "set" or "close".');
                return;
            }

            if (action === 'set') {
                // Validate inputs
                if (!tickerName || isNaN(entryPrice) || isNaN(stopLoss) || isNaN(takeProfit) || isNaN(amount)) {
                    await interaction.editReply('❌ Please provide valid ticker symbol, entry price, stop loss, take profit, and amount of shares.');
                    return;
                }

                // Validate stop loss and take profit
                validatePositionParameters(entryPrice, stopLoss, takeProfit);

                // Update bull market position
                positions[expertName] = positions[expertName] || {};
                positions[expertName][tickerName] = {
                    entryPrice: parseFloat(entryPrice),
                    closedPrice: null,
                    stopLoss: parseFloat(stopLoss),
                    takeProfit: parseFloat(takeProfit),
                    amount: parseInt(amount),
                };
                savePositions(positions);

                const embed = await createLivePortfolioEmbed(expertName);
                await entriesChannel.send({ embeds: [embed] });

                await interaction.editReply(`📈 Bull market position for **${tickerName}** set in **${entriesChannel}**.`);
            } else if (action === 'close') {
                // Close bull market position
                const positionData = positions[expertName]?.[tickerName];

                if (!positionData) {
                    await interaction.editReply(`❌ No open bull market position found for **${tickerName}**.`);
                    return;
                }

                positionData.closedPrice = positionData.entryPrice; // Assuming closing at entry price for simplicity
                delete positions[expertName][tickerName]; // Remove position after closing
                savePositions(positions);

                const embed = await createLivePortfolioEmbed(expertName);
                await entriesChannel.send({ embeds: [embed] });

                await interaction.editReply(`✅ Closed bull market position for **${tickerName}** in **${entriesChannel}**.`);
            }
        }

    } catch (error) {
        console.error(error);
        await interaction.editReply('❌ An error occurred: ' + error.message);
    }
});

// Load initial positions
positions = loadPositions();

// Ready event
client.once(Events.ClientReady, () => {
    console.log(`Logged in as ${client.user.tag}`);
});

// Start the bot
client.login(process.env.BOT_TOKEN);
