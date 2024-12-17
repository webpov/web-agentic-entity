import { SearchMode, Tweet } from "agent-twitter-client";
import {
    composeContext,
    generateMessageResponse,
    generateShouldRespond,
    messageCompletionFooter,
    shouldRespondFooter,
    Content,
    HandlerCallback,
    IAgentRuntime,
    Memory,
    ModelClass,
    State,
    stringToUuid,
    elizaLogger,
    getEmbeddingZeroVector,
} from "@ai16z/eliza";
import { ClientBase } from "./base.ts";
import { buildConversationThread, likeTweet, sendTweet, wait } from "./utils.ts";

export const twitterMessageHandlerTemplate =
    `
# Areas of Expertise
{{knowledge}}

# About {{agentName}} (@{{twitterUserName}}):
{{bio}}
{{lore}}
{{topics}}

{{providers}}

{{characterPostExamples}}

{{postDirections}}

Recent interactions between {{agentName}} and other users:
{{recentPostInteractions}}

{{recentPosts}}

# Task: Generate a post/reply in the voice, style and perspective of {{agentName}} (@{{twitterUserName}}) while using the thread of tweets as additional context:
Current Post:
{{currentPost}}

Thread of Tweets You Are Replying To:
{{formattedConversation}}

{{actions}}

# Task: Generate a post in the voice, style and perspective of {{agentName}} (@{{twitterUserName}}). Include an action, if appropriate. {{actionNames}}:
{{currentPost}}
` + messageCompletionFooter;

export const twitterShouldRespondTemplate =
    `# INSTRUCTIONS: Determine if {{agentName}} (@{{twitterUserName}}) should engage with this post to increase visibility and build connections.

Response options are RESPOND, IGNORE and STOP.

{{agentName}} is looking to engage with interesting posts and build connections with others. The goal is to add value to conversations and be discovered by new users.

RESPOND if:
- The post is somewhat relevant to {{agentName}}'s expertise or interests
- {{agentName}} can add some value or insights to the conversation
- The topic aligns with {{agentName}}'s background and knowledge
- There's an opportunity for an engaging, thoughtful response

IGNORE if:
- The post is not closely related to {{agentName}}'s expertise
- The conversation is already crowded with responses
- There's any doubt about whether to engage

STOP if:
- The conversation has concluded
- The original poster asks to end the interaction
- {{agentName}} has already made their point

{{recentPosts}}

IMPORTANT: Quality over quantity - {{agentName}} should only engage when they can truly add value to the conversation. Each response should be insightful and help build {{agentName}}'s reputation in their area of expertise.

{{currentPost}}

Thread of Tweets You Are Replying To:

{{formattedConversation}}

# INSTRUCTIONS: Respond with [RESPOND] if {{agentName}} should engage with this post, [IGNORE] if {{agentName}} should not engage, or [STOP] if {{agentName}} should end participation.
` + shouldRespondFooter;

export class TwitterLikeClient {
    client: ClientBase;
    runtime: IAgentRuntime;
    private respondedTweets: Set<string> = new Set();

    constructor(client: ClientBase, runtime: IAgentRuntime) {
        this.client = client;
        this.runtime = runtime;
    }

    async start() {
        elizaLogger.log("LIKE: Twitter like client ready, starting handleTwitterLikeLoop");
        this.handleTwitterLikeLoop();
    }

    private handleTwitterLikeLoop() {
        this.handleTwitterLike();
        setTimeout(
            () => this.handleTwitterLikeLoop(),
            Number( 1320) * 1000 // 22 minutes
        );
    }

    private async handleTwitterLike() {
        elizaLogger.log("LIKE: Checking Twitter topics");

        const twitterUsername = this.client.profile.username;
        try {
            // Check for mentions
            // const mentionTweets = (
            //     await this.client.fetchSearchTweets(
            //         `@${twitterUsername}`,
            //         20,
            //         SearchMode.Latest
            //     )
            // ).tweets;
            // elizaLogger.log("DISCOVERY: Found", mentionTweets.length, "mention tweets");

            // Get topics from character configuration
            const topics = this.runtime.character.topics || [];

            // Get random tweets from topics
            let topicTweets: Tweet[] = [];
            if (topics.length > 0) {
                const randomTopic = getRandomElement(topics);
                elizaLogger.log(`DISCOVERY: Searching for topic: ${randomTopic}`);

                const topicSearchResults = await this.client.fetchSearchTweets(
                    randomTopic,
                    4,
                    SearchMode.Latest
                );
                elizaLogger.log("DISCOVERY: Found", topicSearchResults.tweets.length, "topic tweets");
            topicTweets = topicSearchResults.tweets;
            }

            // pick 2 random tweets
            const allTweets = [...topicTweets].sort(() => Math.random() - 0.5).slice(0, 2);
            // const allTweets = [...mentionTweets, ...topicTweets];
            const uniqueTweetCandidates = [...new Set(allTweets)]
                .sort((a, b) => a.id.localeCompare(b.id))
                .filter((tweet) => tweet.userId !== this.client.profile.id);

            elizaLogger.log("DISCOVERY: *** people candidates Found", uniqueTweetCandidates.length, "unique tweets");
            // print first candidate
            elizaLogger.log("DISCOVERY: *** first candidate:", uniqueTweetCandidates[0], this.client.lastCheckedTweetId);
            for (const tweet of uniqueTweetCandidates) {
                if (!!this.client.lastCheckedTweetId) {
                    elizaLogger.log("DISCOVERY: *** this.client.lastCheckedTweetId:", this.client.lastCheckedTweetId - BigInt(tweet.id) , tweet.timeParsed);
                }
                if (
                    !this.client.lastCheckedTweetId ||
                    BigInt(tweet.id) > this.client.lastCheckedTweetId
                ) {
                    await this.processTweet(tweet);
                    this.client.lastCheckedTweetId = BigInt(tweet.id);
                }
            }

            await this.client.cacheLatestCheckedTweetId();
            elizaLogger.log("DISCOVERY: Finished checking Twitter mentions and topics");
        } catch (error) {
            elizaLogger.error("DISCOVERY: Error handling Twitter discovery:", error);
        }
    }

    private async processTweet(tweet: Tweet) {
        const tweetId = stringToUuid(tweet.id + "-" + this.runtime.agentId);

        // Skip if already processed
        const existingResponse = await this.runtime.messageManager.getMemoryById(tweetId);
        if (existingResponse) {
            elizaLogger.log(`DISCOVERY: Already responded to tweet ${tweet.id}, skipping`);
            return;
        }

        // Rate limit topic-based replies (not mentions)
        if (!tweet.text.includes(`@${this.client.profile.username}`)) {
            // Get recent messages using list + sort instead of getRecentMemories
            const recentMessages = await this.runtime.messageManager.getMemories({
                roomId: stringToUuid(tweet.conversationId),
            });
            const lastReplyTime = recentMessages[0]?.createdAt || 0;
            const minInterval = Number(this.runtime.getSetting("TWITTER_TOPIC_REPLY_INTERVAL") || 3600) * 1000; // Default 1 hour

            if (Date.now() - lastReplyTime < minInterval) {
                elizaLogger.log("DISCOVERY: Skipping topic reply due to rate limiting");
                return;
            }
        }

        elizaLogger.log("DISCOVERY: Processing new tweet:", tweet.permanentUrl);

        const roomId = stringToUuid(tweet.conversationId + "-" + this.runtime.agentId);
        const userIdUUID = tweet.userId === this.client.profile.id ?
            this.runtime.agentId :
            stringToUuid(tweet.userId!);

        // Setup connection and get conversation thread
        await this.runtime.ensureConnection(
            userIdUUID,
            roomId,
            tweet.username,
            tweet.name,
            "twitter"
        );

        const thread = await buildConversationThread(tweet, this.client);

        // Create message object
        const message = {
            content: { text: tweet.text },
            agentId: this.runtime.agentId,
            userId: userIdUUID,
            roomId,
        };

        await this.handleTweetResponse(tweet, message, thread);
    }

    private async handleTweetResponse(tweet: Tweet, message: Memory, thread: Tweet[]) {
        if (!message.content.text) {
            elizaLogger.log("DISCOVERY: Skipping Tweet with no text", tweet.id);
            return { text: "", action: "IGNORE" };
        }

        elizaLogger.log("DISCOVERY: Processing Tweet: ", tweet.id);

        // Format the tweet and conversation thread
        const formatTweet = (t: Tweet) => {
            return `  ID: ${t.id}
  From: ${t.name} (@${t.username})
  Text: ${t.text}`;
        };

        const currentPost = formatTweet(tweet);
        const formattedConversation = thread
            .map((t) => `@${t.username} (${new Date(t.timestamp * 1000).toLocaleString("en-US", {
                hour: "2-digit",
                minute: "2-digit",
                month: "short",
                day: "numeric",
            })}):
        ${t.text}`)
            .join("\n\n");

        // Compose state for response generation
        let state = await this.runtime.composeState(message, {
            twitterUserName: this.runtime.getSetting("TWITTER_USERNAME"),
            currentPost,
            formattedConversation,
        });

        // Save the tweet if it doesn't exist
        const tweetId = stringToUuid(tweet.id + "-" + this.runtime.agentId);
        const tweetExists = await this.runtime.messageManager.getMemoryById(tweetId);

        if (!tweetExists) {
            elizaLogger.log("DISCOVERY: Tweet does not exist, saving");
            const userIdUUID = stringToUuid(tweet.userId as string);
            const roomId = stringToUuid(tweet.conversationId);

            const tweetMemory = {
                id: tweetId,
                agentId: this.runtime.agentId,
                content: {
                    text: tweet.text,
                    url: tweet.permanentUrl,
                    inReplyTo: tweet.inReplyToStatusId
                        ? stringToUuid(tweet.inReplyToStatusId + "-" + this.runtime.agentId)
                        : undefined,
                },
                userId: userIdUUID,
                roomId,
                createdAt: tweet.timestamp * 1000,
            };
            await this.runtime.messageManager.createMemory(tweetMemory);
        }
        try {
            await likeTweet(this.client, tweet.id);
            elizaLogger.log("LIKE: Liked tweet:", tweet.id);
        } catch (error) {
            elizaLogger.error("LIKE: Error liking tweet:", error);
        }

    }

    // Rest of the implementation follows similar pattern to TwitterInteractionClient
    // but using the structure from search.ts
    // ...
}

function getRandomElement<T>(array: T[]): T {
    return array[Math.floor(Math.random() * array.length)];
}
