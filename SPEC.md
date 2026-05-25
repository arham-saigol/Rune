Build an app called Rune. Rune is a personal second brain and a private tool for a single user to save content from the internet from platforms such as YouTube, X (formerly Twitter), Instagram, Reddit, and Product Hunt. Users can later recall, browse, and have a conversation about everything they have collected.

An AI agent, also called Rune, is built into the app and has full access to all saved content. Rune solves the problem of information overload by serving as a living archive of your interests that is searchable, conversational, and self-organizing.

1. Capture and Processing
   (a) Users can share links from their phone to a Discord bot, which saves the content to the archive. Users can also chat with the agent directly within Discord.
   (b) The backend pipeline uses yt-dlp to save video files and Exa API for web search and fetching content from articles and blogs.
   (c) For every item saved, the system generates a title, a short summary for the AI (to assist with semantic search), and five keywords.
   (d) Content is embedded using the Voyage 4 series models (the standard model for embeddings and the light model for search results).

2. Web and Mobile App (PWA)
   (a) On desktop, Rune is accessed via a browser. On mobile, it is a Progressive Web App (PWA) added to the home screen to remove browser UI for a native feel.
   (b) The main interface features a search bar and a grid of cards representing saved items.
   (c) Items are organized by tags. Default tags include SEO, AI, SaaS, Dev, Design, Startup, Marketing, and Productivity. Users can also create their own.
   (d) Navigation includes tabs to switch between categories and filters for unread or pinned items.
   (e) There are two item states: unread and read. When an item is opened, it becomes "read" and the card dims.
   (f) A "For You" page should be the default view, showing related interests and suggesting what the user should look at next. If this isn't possible, the "All" page will be the default.

3. The Rune Agent
   (a) In the web app, the agent lives in a side panel. It can perform semantic searches by topic, date, or category.
   (b) When a user opens an item, they can open the agent panel right there. The current item is automatically added to the chat context, though the user can remove it if they wish.
   (c) The agent can use saved items as references or perform web searches for further details.

4. Item View and Summary Modes
   When an item is clicked, it opens full screen. Users can see the source, copy the link, and choose from several AI-generated summary modes:
   (a) Short Summary: One to three paragraphs.
   (b) Five Points: Five tight bullet points covering key ideas.
   (c) Explore Like I am 5: A simple explanation for a beginner.
   (d) Devil's Advocate: Two opposing perspectives on the content.

5. Visual Design
   (a) The overall aesthetic should be warm, illustrative, and retro. It should feel like a handcrafted personal collection—like a sketchbook or a collector’s cabinet—rather than a typical SaaS dashboard or productivity tool.
   (b) The cards for the items on the main page of the web app should not just be text cards. I want them to have some kind of sketch attached to them that is relevant to the item. There are two ways we could handle this:
       1. The librarian agent (the one in charge of saving everything) could use something like Rough.js every time to create a custom sketch specifically for whatever is being saved.
       2. We could have a unique platform-wise sketch for each source that acts as a banner.

6. CLI Tool
   The app should also include a CLI tool to help users set it up on a brand-new VPS. It should have a "rune setup" command that runs the entire process:
   (a) It checks for all necessary dependencies the agent needs on the VPS and installs anything that is missing. Should configure a systemd service.
   (b) It prompts the user to add API keys one by one, including the DeepSeek API key, the Exa API key (which will provide search capabilities), the Voyage API key, and the required Discord integration.
   This app is designed to run on a VPS, and ideally, the setup wizard should also configure Cloudflare tunnel for the user if possible. Authentication for the app will be managed through a Cloudflare Access policy.
   The CLI commands include:
   1. rune setup
      Runs the setup wizard.
   2. rune setup api
      Allows the user to add any API key again. If they skip this step, the same API key stays; if they add a new one, it overrides the existing key. This should show all API keys except for the Discord connection and configurations.
   3. rune setup discord
      Shows the Discord-specific settings if the user wants to change to another bot.
   4. rune start
      Starts the app gateway.
   5. rune restart
      Restarts the gateway.
   6. rune stop
      Stops the daemon gateway.

7. AI
   We will be using DeepSeek models for this app, specifically DeepSeek V4 Pro and DeepSeek V4 Flash. The pipeline uses AI in three different places:
   (a) The main Rune agent: This is the primary agent the user talks to, and it will use DeepSeek V4 Pro.
   (b) The librarian agent: When the user saves content, they can provide a link and add extra context. The main Rune agent will then call the librarian agent to handle the saving process. The librarian is in charge of writing the title, meta summary, and meta keywords, as well as creating the illustration. It will also be responsible for actually fetching the content if that process isn't automated, as the model is capable of trying a fallback method if the first attempt fails. The librarian agent will also use DeepSeek V4 Pro.
   (c) Item summary modes: Summary modes are not generated automatically when an item is added; they are only generated when a user clicks on an item. Each mode has a different system prompt. When a user opens a page, the entire context (such as a full YouTube transcript or web article) is sent to DeepSeek V4 Flash. 
   By default, the app will generate the user's selected mode (for example, "Explain Like I'm 5") immediately upon opening the item, showing a shimmering animation while it processes. If the user selects a different mode, that will also be generated instantly. Once a summary is generated for an item, it is saved so it is ready the next time the item is opened. DeepSeek V4 Flash is the better choice here as it is faster and the task is not overly complex.   
   
8. Web Search
   The main Rune agent should have web search and web fetch tools, while the Librarian agent should only have the web fetch tool. If we give the Librarian web search as well, it may deviate and start searching for other things when that isn't its job; it should just retrieve whatever the user has shared a link for, so it honestly doesn't need search.
   The summary agent (the one that uses DeepSeek V4 Flash) should have both web search and fetch tools. This would be useful in modes like "Devil's Advocate" when it needs to find opposing sides. Many relevant topics may be after its knowledge cutoff, so it may need to search for current information.
   This is also useful across all other modes because the model has a knowledge cutoff, and if the user shares things that happened after that date, the model may start hallucinating or fail to explain them properly. I think it would be especially useful in Devil's Advocate to gain more context for taking opposing sides, but generally, the agent should be told to rely on the provided source. However, there are exceptions where it can perform searches.

9. Tech Stach
   (a) For the tech stack, the deployment target of Rune is a VPS. We want to deploy this on a VPS and ensure it can be accessed via a Cloudflare Tunnel and Access Policy.
   (b) We want to use the official Discord adapter from the Chat SDK recently launched by Vercel. We should use it over WebSockets so that no public webhook URL is needed.
   (c) AI SDK v6
   (d) We want to use the Vercel AI Gateway for DeepSeek models, with the DeepSeek API key as a backup. In the settings, the user should be able to change the priority order to determine which is primary and which is the fallback.
   (e) We will use the Voyage API key for the Voyage models we are using.
   (f) Use Exa for web search and fetch.
   (g) On the VPS, we will use SQLite for the database.
   (h) Use Deepgram for the transcription with yt-dlp.
   (d) For YouTube videos we want to use SupaData first; if that fails, then the yt-dlp approach should be used. User will also need SupaData API key.
   Additionally, since there are no restrictions on the platform, users may add videos from many different sources. In those cases, the yt-dlp approach should also be used. With the help of yt-dlp, we can retrieve videos or audio files for transcription from over 1,000 platforms, if I am not mistaken.

10. For You
    The "For You" page is the default view of the app. It is a personalized feed that surfaces the most relevant saved items based on the user's reading patterns and interests, rather than just showing everything in reverse chronological order.
    (a) The feed is computed using the Voyage embeddings already generated at save time — no additional AI calls are made. Scoring runs once when the page loads and the result is held in place for the entire session. The feed does not update while the user is browsing, so items do not disappear or shift position between visits to individual items. The feed only recomputes on a full page reload.
    (b) On the mobile PWA, the same rule applies. The feed updates in two situations: a full reload, or a pull-to-refresh gesture when the user has scrolled to the top of the page. Scrolling fully to the bottom of the feed does not trigger a refresh — it loads more items from the already-computed session results.
    (c) The following signals are used to score each unread item:
        1. **Recency of related reads.** Items semantically similar to things the user has opened in the last seven days score higher.
        2. **Tag affinity.** Tags from recently read items are used to weight items that share those tags.
        3. **Pinned items.** Items the user has pinned are treated as strong interest signals. Any item semantically close to a pinned item receives a scoring boost.
        4. **Staleness penalty.** Items that have been sitting unread in the archive for a long time are penalized slightly to keep the feed from stagnating.
        5. **Recency of save.** Newly saved items receive a small boost so fresh content is not buried entirely.
    (d) Diversity is enforced at the point the feed is assembled, both at the top level and within each category. No single tag may occupy more than roughly one third of the overall feed. Within any given category view, items from different sources and topics are interleaved so that the feed does not collapse into a single subject even during periods of focused reading on one topic.
    (e) The final output is presented as a standard card grid, identical in appearance to the rest of the app. There is no visible algorithm UI and no explanation of why each item was surfaced. It should feel like a natural, well-ordered collection, not a recommendation engine.