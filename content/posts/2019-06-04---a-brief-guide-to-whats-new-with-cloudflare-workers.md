---
title: "A Brief Guide To What's New With Cloudflare Workers"
date: '2019-06-04T09:00:00.121Z'
template: 'post'
draft: false
slug: '/posts/a-brief-guide-to-whats-new-with-cloudflare-workers/'
category: 'Tutorial'
tags:
  - 'Cloudflare Workers'
description: "Let's unpack all the new things that the Cloudflare Workers team launched this weekend, and learn how to get started!"
---

Over the weekend, at JSConfEU 2019, [@ag_dubs](https://twitter.com/ag_dubs) took the stage to tell the conference about the serverless platform we've been building at Cloudflare.

<blockquote class="twitter-tweet" data-lang="en"><p lang="en" dir="ltr">📺 <a href="https://twitter.com/ag_dubs?ref_src=twsrc%5Etfw">@ag_dubs</a>&#39; talk from <a href="https://twitter.com/jsconfeu?ref_src=twsrc%5Etfw">@jsconfeu</a>, &quot;JavaScript&#39;s Journey to the Edge&quot;, is up on youtube! edge-side compute + render = the future 🤯 <a href="https://twitter.com/hashtag/serverless?src=hash&amp;ref_src=twsrc%5Etfw">#serverless</a><a href="https://t.co/7Tw8xmwfv7">https://t.co/7Tw8xmwfv7</a></p>&mdash; signalnerve (@signalnerve) <a href="https://twitter.com/signalnerve/status/1135659789739057153?ref_src=twsrc%5Etfw">June 3, 2019</a></blockquote>
<script async src="https://platform.twitter.com/widgets.js" charset="utf-8"></script>

Immediately after that talk ended, a _massive_ amount of updates for Cloudflare Workers went live. Seriously - even one of these would be an exciting release, but altogether, the team shipped _six_ new updates to our serverless platform:

- An official, open-source Workers CLI tool, [Wrangler][wrangler]
- A new and improved [documentation](https://workers.cloudflare.com/docs)
- Support for deploying multiple Workers scripts to your domain
- Free workers.dev subdomain to deploy your applications
- A free tier for Workers: up to 100k requests _per day_ (!)
- An improved interface for editing and publishing your applications

The result: a super fast platform to deploy your serverless applications, and a rock-solid CLI tool, with the documentation to back it up.

<blockquote class="twitter-tweet" data-lang="en"><p lang="en" dir="ltr">🎁 Updates to <a href="https://twitter.com/Cloudflare?ref_src=twsrc%5Etfw">@cloudflare</a> Workers today:<br><br>🆓 100k requests/day free tier<br>🤠 A brand-new CLI<br>📔 Brand new docs site<br>🥳 Free <a href="https://t.co/Lr1dzwH1vN">https://t.co/Lr1dzwH1vN</a> subdomains to deploy your projects<br><br>More on this next week, but check out <a href="https://twitter.com/ritakozlov_?ref_src=twsrc%5Etfw">@ritakozlov_</a>&#39;s writeup 👇<a href="https://t.co/hmHmntDxLN">https://t.co/hmHmntDxLN</a></p>&mdash; signalnerve (@signalnerve) <a href="https://twitter.com/signalnerve/status/1135189702997360641?ref_src=twsrc%5Etfw">June 2, 2019</a></blockquote>
<script async src="https://platform.twitter.com/widgets.js" charset="utf-8"></script>

So! With all that said, how do we get started? One of my primary goals as the developer advocate for Workers is to make it easier for developers to get started with the platform. With the launch of our new CLI tool, this is easier than ever. Let's deploy a simple application using Workers, so we can see what this looks like in practice.

_Quick aside: to deploy your application to Workers, you'll need a Cloudflare account. Good news! We have a fancy new sign-up flow to help you do that. [Sign up here](https://dash.cloudflare.com/sign-up/workers)._

## Installing and Generating

[Wrangler][wrangler] is our shiny new command-line tool for creating, building, and publishing Cloudflare Workers projects. Installing it is super straightforward:

```sh
npm install -g @cloudflare/wrangler
```

To ensure Wrangler installed successfully, run `wrangler --help`:

![Wrangler help](/media/brief-guide-workers/verify-wrangler-install.gif)

One of my favorite Wrangler features is the `generate` command. We've built a ton of templates (check out our [Template Gallery](https://workers.cloudflare.com/docs/templates/)) that make it super easy to started with a new Workers project quickly. By default, Wrangler uses our JavaScript + Webpack template, so you'll be able to immediately begin working with NPM packages and use new JavaScript features in your project. Let's try the `generate` command now:

```sh
wrangler generate my-first-app
cd my-first-app
```

Behind the scenes, Wrangler uses Git to make a copy of our template and fills in your configuration details, to make the project your own. Now that you've created a project, let's look inside the code, by opening `index.js`:

```js
addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

/**
 * Fetch and log a request
 * @param {Request} request
 */
async function handleRequest(request) {
  return new Response('Hello worker!', { status: 200 })
}
```

Every Workers application begins by listening for a `fetch` event. When a client makes an HTTP request to your application, your Workers code can respond to that event using `event.respondWith`: that response should, fittingly, return an instance of the JavaScript [Response](https://workers.cloudflare.com/docs/reference/runtime/apis/fetch/#response) class.

Our event handler, `handleRequest`, is pretty simple. It takes in a `request` argument (of type [Request](https://workers.cloudflare.com/docs/reference/runtime/apis/fetch/#request)), and creates a new `Response` to return to the client. This response returns the text "Hello worker"; by changing the body of your response (the first argument), and setting custom headers and statuses, you can build and return any response to the client that you'd like!

If you've ever worked with [Service Workers](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API/Using_Service_Workers), this API should be familiar to you. The Workers platform API is modeled heavily after the Service Worker API, so even if you're new to developing on the Workers platform, things like `addEventListener` and event handling should help you feel a little more comfortable - it's still just JavaScript!

All Workers applications are deployed to "the edge": it's a fancy term for the vast [network](https://www.cloudflare.com/network/) of Cloudflare servers around the world. What this means in practice is that your application is served _very_ close to your users. This model of building _edge appliations_ is a pretty remarkable shake-up of the typical client/server model: your users don't need to make requests back and forth from a server in Virginia to work with your application - instead, your application will be published to the closest Cloudflare server to all your users, around the world. Building applications on the edge is _super exciting_, and I'm stoked to be able to continue to explore the implications of that in the future.

## Configuring and Publishing

With an application handling requests, and serving responses, we can now take our code and ship it off to the edge! While Wrangler is great, unfortunately, we can't escape having to do a little bit of housekeeping, in the form of configuration: Wrangler needs your Cloudflare account details to be able to deploy your projects successfully. You'll need a few values from your Cloudflare account to deploy code to Cloudflare Workers:

- Global API key
- Email address associated with your Cloudflare account
- Account ID

To find those values, we've written up a brief guide in the docs for you to get the info quickly: ["Finding Your Cloudflare API Keys"](https://workers.cloudflare.com/docs/quickstart/api-keys/)

With those values at the ready, let's configure Wrangler to deploy to your Cloudflare Workers account. To do this, we'll use Wrangler's `config` command! You should only need to do this once:

```sh
wrangler config <email> <global_api_key>
```

To configure your project, complete the `wrangler.toml` file at the root of the generated project. This file contains the information Wrangler needs to connect to the Cloudflare Workers API and publish your code. Our main task in this file is to fill in the `account_id` field, with the value found in your dashboard.

```toml
# The name of your Workers application
name = "my-first-app"

# Your Cloudflare account ID
account_id = "$yourAccountId"

# The kind of application you're deploying to Cloudflare (defaults to "webpack")
type = "webpack"
```

One more configuration step, and it's an important one: it's time to pick your `workers.dev` subdomain. Each Cloudflare user gets one, so pick wisely! For my projects, I'll be deploying to `signalnerve.workers.dev`. When you're ready to claim a subdomain (you can skip this if you _already_ have a subdomain), use the `subdomain` command:

```sh
wrangler subdomain signalnerve
```

Wrangler's updated configuration means that all new applications will be deployed onto that domain: for instance, our project `my-first-app` would be published at `my-first-app.signalnerve.workers.dev`.

With a configured subdomain, the only thing left to do is publish our project. Hooray! As you might imagine, we have a command for that, too:

```sh
wrangler publish
```

Wrangler will take your project, build it, and send it up to our network. Almost immediately, you should see the project running live at your domain:

![Live](/media/brief-guide-workers/live.png)

And with that, we've deployed our first Workers application - nice!

Where do we go from here? If you're interested in learning what you can build, our new documentation has some great tutorials to help you [build an application](https://workers.cloudflare.com/docs/tutorials/build-an-application) or [build a serverless function](https://workers.cloudflare.com/docs/tutorials/build-a-serverless-function), and as mentioned previously, a growing number of templates in the [Template Gallery](https://workers.cloudflare.com/docs/templates/) to use for your next great project.

Did you deploy something using Workers? Please let me know! I'd love to hear about what went well (and what didn't) [on Twitter](https://twitter.com/signalnerve).

[wrangler]: https://github.com/cloudflare/workers
