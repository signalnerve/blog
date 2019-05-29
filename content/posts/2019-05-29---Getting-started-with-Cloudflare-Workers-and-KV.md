---
title: 'Getting started with Cloudflare Workers and KV'
date: '2019-05-14T09:00:00.121Z'
template: 'post'
draft: false
slug: '/posts/getting-started-with-cloudflare-workers-and-kv/'
category: 'Tutorial'
tags:
  - 'Cloudflare Workers'
description: "In this tutorial, we'll build a todo list application in HTML, CSS and JavaScript, with a twist: all the data should be stored inside of the newly-launched Workers KV, and the application itself should be served directly from Cloudflare's edge network, using Cloudflare Workers."
---

In this tutorial, we'll build a todo list application in HTML, CSS and JavaScript, with a twist: all the data should be stored inside of the newly-launched Workers KV, and the application itself should be served directly from Cloudflare's edge network, using Cloudflare Workers.

To start, let's break this project down into a couple different discrete steps. In particular, it can help to focus on the constraint of working with Workers KV, as handling data is generally the most complex part of building an application:

1. Build a todos data structure
2. Write the todos into Workers KV
3. Retrieve the todos from Workers KV
4. Return an HTML page to the client, including the todos (if they exist)
5. Allow creation of new todos in the UI
6. Allow completion of todos in the UI
7. Handle todo updates

This task order is pretty convenient, because it's almost perfectly split into two parts: first, understanding the Cloudflare/API-level things we need to know about Workers _and_ KV, and second, actually building up a user interface to work with the data.

## Understanding Workers

In terms of implementation, a great deal of this project is centered around KV - although that may be the case, it's useful to break down _what_ Workers are exactly.

Service Workers are background scripts that run in your browser, alongside your application. Cloudflare Workers are the same concept, but super-powered: your Worker scripts run on Cloudflare's edge network, in-between your application and the client's browser. This opens up a huge amount of opportunity for interesting integrations, especially considering the network's massive scale around the world. Here's some of the use-cases that I think are the most interesting:

1. Custom security/filter rules to block bad actors before they ever reach the origin
2. Replacing/augmenting your website's content based on the request content (i.e. user agents and other headers)
3. Caching requests to improve performance, or using Cloudflare KV to optimize high-read tasks in your application
4. Building an application _directly_ on the edge, removing the dependence on origin servers entirely

For this project, we'll lean heavily towards the latter end of that list, building an application that clients communicate with, served on Cloudflare's edge network. This means that it'll be globally available, with low-latency, while still allowing the ease-of-use in building applications directly in JavaScript.

## Setting up a canvas

To start, I wanted to approach this project from the bare minimum: no frameworks, JS utilities, or anything like that. In particular, I was most interested in writing a project from scratch and serving it directly from the edge. Normally, I would deploy a site to something like [GitHub Pages](https://pages.github.com/), but avoiding the need for an origin server altogether seems like a really powerful (and performant idea) - let's try it!

I also considered using [TodoMVC](https://todomvc.com/) as the blueprint for building the functionality for the application, but even the [Vanilla JS](http://todomvc.com/examples/vanillajs/#/) version is a pretty impressive amount of [code](https://github.com/tastejs/todomvc/tree/gh-pages/examples/vanillajs), including a number of Node packages - it wasn't exactly a concise chunk of code to just dump into the Worker itself.

Instead, I decided to approach the beginnings of this project by building a simple, blank HTML page, and including it inside of the Worker. To start, we'll sketch something out locally, like this:

```html
<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>Todos</title>
  </head>
  <body>
    <h1>Todos</h1>
  </body>
</html>
```

Hold on to this code - we'll add it later, inside of the Workers script. For the purposes of the tutorial, I'll be serving up this project at `todo.kristianfreeman.com`,. My personal website was already hosted on Cloudflare, and since I'll be serving , it was time to create my first Worker.

## Creating a worker

Inside of my Cloudflare account, I hopped into the Workers tab and launched the Workers editor.

This is one of my favorite features of the editor - working with your actual website, understanding _how_ the worker will interface with your existing project.

![Editor](/media/kv-tutorial/editor.png)

The process for working with a Worker should be familiar to anyone who's worked with the `fetch` library before. In short, the default code for a Worker hooks into the `fetch` event, passing the `request` of that event into a custom function, `handleRequest`:

```javascript
addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})
```

Within `handleRequest`, we make the actual request, using `fetch`, and return the response to the client. In short, we have a place to intercept the response body, but by default, we let it pass-through:

```javascript
async function handleRequest(request) {
  console.log('Got request', request)
  const response = await fetch(request)
  console.log('Got response', response)
  return response
}
```

So, given this, where do we begin actually _doing stuff_ with our worker?

Unlike the default code given to you in the Workers interface, we want to skip fetching the incoming request: instead, we'll construct a new `Response`, and serve it directly from the edge:

```javascript
async function handleRequest(request) {
  const response = new Response('Hello!')
  return response
}
```

Given that very small functionality we've added to the worker, let's deploy it. Moving into the "Routes" tab of the Worker editor, I added the route `https://todo.kristianfreeman.com/*` and attached it to the `cloudflare-worker-todos` script.

![Setting up a route](/media/kv-tutorial/route.png)

Once they were attached, I deployed the worker, and voila! Visiting `todo.kristianfreeman.com` in-browser gives me my simple "Hello!" response back.

![Basic UI in Editor](/media/kv-tutorial/basic_editor.png)

## Adding KV

The next step is to populate our todo list with actual data. To do this, we'll make use of Cloudflare's Workers KV tool - it's a simple key-value store that you can access inside of your Worker script to read (and write, although it's less common) data.

To get started with KV, we need to set up a "namespace". All of our cached data will be stored inside that namespace, and given just a bit of configuration, we can access that namespace inside the script with a predefined variable.

I'll create a new namespace called `KRISTIAN_TODOS`, and in the Worker editor, I'll expose the namespace by binding it to the variable `KRISTIAN_TODOS`.

![Setting up a binding](/media/kv-tutorial/binding.png)

Given the presence of `KRISTIAN_TODOS` in my script, it's time to understand the KV API. At time of writing, a KV namespace has three primary methods you can use to interface with your cache: `get`, `put`, and `delete`. Pretty straightforward!

Let's start storing data by defining an initial set of data, which we'll put inside of the cache using the `put` method. I've opted to define an object, `defaultData`, instead of a simple array of todos: we may want to store metadata and other information inside of this cache object later on. Given that data object, I'll use `JSON.stringify` to put a simple string into the cache:

```javascript
async function handleRequest(request) {
  // ...previous code

  const defaultData = {
    todos: [
      {
        id: 1,
        name: 'Finish the Cloudflare Workers blog post',
        completed: false,
      },
    ],
  }
  KRISTIAN_TODOS.put('data', JSON.stringify(defaultData))
}
```

The Worker KV data store is _eventually_ consistent: writing to the cache means that it will become available _eventually_, but it's possible to attempt to read a value back from the cache immediately after writing it, only to find that the cache hasn't been updated yet.

Given the presence of data in the cache, and the assumption that our cache is eventually consistent, we should adjust this code slightly: first, we should actually read from the cache, parsing the value back out, and using it as the data source if exists. If it doesn't, we'll refer to `defaultData`, setting it as the data source _for now_ (remember, it should be set in the future... _eventually_), while also setting it in the cache for future use. After breaking out the code into a few functions for simplicity, the result looks like this:

```javascript
const defaultData = {
  todos: [
    {
      id: 1,
      name: 'Finish the Cloudflare Workers blog post',
      completed: false,
    },
  ],
}

const setCache = data => KRISTIAN_TODOS.put('data', data)
const getCache = () => KRISTIAN_TODOS.get('data')

async function getTodos(request) {
  // ... previous code

  let data
  const cache = await getCache()
  if (!cache) {
    await setCache(JSON.stringify(defaultData))
    data = defaultData
  } else {
    data = JSON.parse(cache)
  }
}
```

## Using data from KV

Given the presence of `data` in our code, which is the cached data object for our application, we should actually take this data and make it available on screen.

In our Workers script, we'll make a new variable, `html`, and use it to build up a static HTML template that we can serve to the client. In `handleRequest`, we can construct a new `Response` (with a `Content-Type` header of `text/html`), and serve it to the client:

```javascript
const html = `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>Todos</title>
  </head>
  <body>
    <h1>Todos</h1>
  </body>
</html>
`

async function handleRequest(request) {
  const response = new Response(html, {
    headers: { 'Content-Type': 'text/html' },
  })
  return response
}
```

We have a static HTML site being rendered, and now we can begin populating it with data! In the `body`, we'll add a `ul` tag with an id of `todos`:

```html
<body>
  <h1>Todos</h1>
  <ul id="todos"></ul>
</body>
```

Given that body, we can also add a script _after_ the body that takes a `todos` array, loops through it, and for each todo in the array, creates a `li` element and appends it to the `todos` list:

```html
<script>
  window.todos = []
  var todoContainer = document.querySelector('#todos')
  window.todos.forEach(todo => {
    var el = document.createElement('li')
    el.innerHTML = todo.name
    todoContainer.appendChild(el)
  })
</script>
```

Our static page can take in `window.todos`, and render HTML based on it, but we haven't actually passed in any data from KV. To do this, we'll need to make a couple changes.

First, our `html` _variable_ will change to a _function_. The function will take in an argument, `todos`, which will populate the `window.todos` variable in the above code sample:

```javascript
const html = todos => `
<!doctype html>
<html>
  <!-- ... -->
  <script>
    window.todos = ${todos || []}
    var todoContainer = document.querySelector("#todos");
    // ...
  <script>
</html>
`
```

In `handleRequest`, we can use the retrieved KV `data` to call the `html` function, and generate a `Response` based on it:

```javascript
async function handleRequest(request) {
  let data

  // Set data using cache or defaultData from previous section...

  const body = html(JSON.stringify(data.todos))
  const response = new Response(body, {
    headers: { 'Content-Type': 'text/html' },
  })
  return response
}
```

The finished product looks something like this:

![Simple UI](/media/kv-tutorial/simple.png)

## Adding todos from the UI

At this point, we've built a Cloudflare Worker that takes data from Cloudflare KV and renders a static page based on it. That static page reads the data, and generates a todo list based on that data. Of course, the piece we're missing is _creating_ todos, from inside the UI. We know that we can add todos using the KV API - we could simply update the cache by saying `KRISTIAN_TODOS.put(newData)`, but how do we update it from inside the UI?

It's worth noting here that Cloudflare's Workers documentation suggests that any writes to your KV namespace happen via their API - that is, at its simplest form, a cURL statement:

```sh
curl "<https://api.cloudflare.com/client/v4/accounts/$ACCOUNT_ID/storage/kv/namespaces/$NAMESPACE_ID/values/first-key>" \
  -X PUT \
  -H "X-Auth-Email: $CLOUDFLARE_EMAIL" \
  -H "X-Auth-Key: $CLOUDFLARE_AUTH_KEY" \
  --data 'My first value!'
```

We'll implement something similar by handling a second route in our worker, designed to watch for `PUT` requests to `/`. When a body is received at that URL, the worker will send the new todo data to our KV store.

I'll add this new functionality to my worker, and in `handleRequest`, if the request method is a `PUT`, it will take the request body and update the cache:

```javascript
addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

const putInCache = body => {
  const accountId = '$accountId'
  const namespaceId = '$namespaceId'
  const key = 'data'
  return fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/storage/kv/namespaces/${namespaceId}/values/${key}`,
    {
      method: 'PUT',
      body,
      headers: {
        'X-Auth-Email': '$accountEmail',
        'X-Auth-Key': '$authKey',
      },
    },
  )
}

async function updateTodos(request) {
  const body = await request.text()
  const ip = request.headers.get('CF-Connecting-IP')
  const cacheKey = `data-${ip}`
  try {
    JSON.parse(body)
    await putInCache(cacheKey, body)
    return new Response(body, { status: 200 })
  } catch (err) {
    return new Response(err, { status: 500 })
  }
}

async function handleRequest(request) {
  if (request.method === 'PUT') {
    return updateTodos(request)
  } else {
    // Defined in previous code block
    return getTodos(request)
  }
}
```

The script is pretty straightforward - we check that the request is a `PUT`, and wrap the remainder of the code in a `try/catch` block. First, we parse the body of the request coming in, ensuring that it is JSON, before we update the cache with the new data, and return it to the user. If anything goes wrong, we simply return a 500. If the route is hit with an HTTP method _other_ than `PUT` - that is, GET, DELETE, or anything else - we return a 404.

With this script, we can now add some "dynamic" functionality to our HTML page to actually hit this route.

First, we'll create an `input` for our todo "name", and a `button` for "submitting" the todo.

```html
<div>
	<input type="text" name="name" placeholder="A new todo"></input>
	<button id="create">Create</button>
</div>
```

Given that `input` and `button`, we can add a corresponding JavaScript function to watch for clicks on the `button` - once the `button` is clicked, the browser will `PUT` to `/` and submit the todo.

```javascript
var createTodo = function() {
  var input = document.querySelector('input[name=name]')
  if (input.value.length) {
    fetch('/', {
      method: 'PUT',
      body: JSON.stringify({ todos: todos }),
    })
  }
}

document.querySelector('#create').addEventListener('click', createTodo)
```

This code updates the cache, but what about our local UI? Remember that the KV cache is _eventually consistent_ - even if we were to update our worker to read from the cache and return it, we have no guarantees it'll actually be up-to-date. Instead, let's just update the list of todos locally, by taking our original code for rendering the todo list, making it a re-usable function called `populateTodos`, and calling it when the page loads _and_ when the cache request has finished:

```javascript
var populateTodos = function() {
  var todoContainer = document.querySelector('#todos')
  todoContainer.innerHTML = null
  window.todos.forEach(todo => {
    var el = document.createElement('li')
    el.innerHTML = todo.name
    todoContainer.appendChild(el)
  })
}

populateTodos()

var createTodo = function() {
  var input = document.querySelector('input[name=name]')
  if (input.value.length) {
    todos = [].concat(todos, {
      id: todos.length + 1,
      name: input.value,
      completed: false,
    })
    fetch('/', {
      method: 'PUT',
      body: JSON.stringify({ todos: todos }),
    })
    populateTodos()
    input.value = ''
  }
}

document.querySelector('#create').addEventListener('click', createTodo)
```

With the client-side code in place, deploying the new Worker should put all these pieces together. The result is an actual dynamic todo list!

![Demo](/media/kv-tutorial/demo.gif)

## Updating todos from the UI

For the final piece of our (very) basic todo list, we need to be able to update todos - specifically, marking them as completed.

Luckily, a great deal of the infrastructure for this work is already in place. We can currently update the todo list data in our cache, as evidenced by our `createTodo` function. Performing updates on a todo, in fact, is much more of a client-side task than a Worker-side one!

To start, let's update the client-side code for generating a todo. Instead of a `ul`-based list, we'll migrate the todo container _and_ the todos themselves into using `div`s:

```html
<!-- <ul id="todos"></ul> becomes... -->
<div id="todos"></div>
```

The `populateTodos` function can be updated to generate a `div` for each todo. In addition, we'll move the name of the todo into a child element of that `div`:

```javascript
var populateTodos = function() {
  var todoContainer = document.querySelector('#todos')
  todoContainer.innerHTML = null
  window.todos.forEach(todo => {
    var el = document.createElement('div')
    var name = document.createElement('span')
    name.innerHTML = todo.name
    el.appendChild(name)
    todoContainer.appendChild(el)
  })
}
```

So far, we've designed the client-side part of this code to take an array of todos in, and given that array, render out a list of simple HTML elements. There's a number of things that we've been doing that we haven't quite had a use for, yet: specifically, the inclusion of IDs, and updating the `completed` value on a todo. Luckily, these things work well together, in order to support actually updating todos in the UI.

To start, it would be useful to signify the ID of each todo in the HTML. By doing this, we can then refer to the element later, in order to correspond it to the todo in the JavaScript part of our code. _[Data attributes](https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/dataset)_, and the corresponding `dataset` method in JavaScript, are a perfect way to implement this. When we generate our `div` element for each todo, we can simply attach a data attribute called `todo` to each div:

```javascript
window.todos.forEach(todo => {
  var el = document.createElement('div')
  el.dataset.todo = todo.id
  // ... more setup

  todoContainer.appendChild(el)
})
```

Inside our HTML, each `div` for a todo now has an attached data attribute, which looks like:

```html
<div data-todo="1"></div>
<div data-todo="2"></div>
```

Now we can generate a checkbox for each todo element. This checkbox will default to unchecked for new todos, of course, but we can mark it as checked as the element is rendered in the window:

```javascript
window.todos.forEach(todo => {
  var el = document.createElement('div')
  el.dataset.todo = todo.id

  var name = document.createElement('span')
  name.innerHTML = todo.name

  var checkbox = document.createElement('input')
  checkbox.type = 'checkbox'
  checkbox.checked = todo.completed ? 1 : 0

  el.appendChild(checkbox)
  el.appendChild(name)
  todoContainer.appendChild(el)
})
```

The checkbox is set up to correctly reflect the value of `completed` on each todo, but it doesn't yet update when we actually check the box! To do this, we'll add an event listener on the `click` event, calling `completeTodo`. Inside the function, we'll inspect the checkbox element, finding its parent (the todo `div`), and using the "todo" data attribute on it to find the corresponding todo in our data. Given that todo, we can toggle the value of completed, update our data, and re-render the UI:

```javascript
var completeTodo = function(evt) {
  var checkbox = evt.target
  var todoElement = checkbox.parentNode

  var newTodoSet = [].concat(window.todos)
  var todo = newTodoSet.find(t => t.id == todoElement.dataset.todo)
  todo.completed = !todo.completed
  todos = newTodoSet
  updateTodos()
}
```

The final result of our code is a system that simply checks the `todos` variable, updates our Cloudflare KV cache with that value, and then does a straightforward re-render of the UI based on the data it has locally.

![Final UI in editor](/media/kv-tutorial/final_in_editor.png)

## Conclusions and next steps

With this, we've created a pretty remarkable project: an almost entirely static HTML/JS application, transparently powered by Cloudflare KV and Workers, served at the edge. There's a number of additions to be made to this application, whether you want to implement a better design (I'll leave this as an exercise for readers to implement - you can see my version at [todo.kristianfreeman.com](https://todo.kristianfreeman.com/)), security, speed, etc.

![Final UI](/media/kv-tutorial/final.png)

One interesting and fairly trivial addition is implementing per-user caching. Of course, right now, the cache key is simply "data": anyone visiting the site will share a todo list with any other user. Because we have the request information inside of our worker, it's easy to make this data user-specific. For instance, implementing per-user caching by generating the cache key based on the requesting IP:

```javascript
const ip = request.headers.get('CF-Connecting-IP')
const cacheKey = `data-${ip}`
const getCache = key => KRISTIAN_TODOS.get(key)
getCache(cacheKey)
```

One more deploy of our Workers project, and we have a full todo list application, with per-user functionality, served at the edge!

The final version of our Workers script looks like this:

```javascript
const html = todos => `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>Todos</title>
    <link href="https://cdn.jsdelivr.net/npm/tailwindcss/dist/tailwind.min.css" rel="stylesheet"></link>
  </head>

  <body class="bg-blue-100">
    <div class="w-full h-full flex content-center justify-center mt-8">
      <div class="bg-white shadow-md rounded px-8 pt-6 py-8 mb-4">
        <h1 class="block text-grey-800 text-md font-bold mb-2">Todos</h1>
        <div class="flex">
          <input class="shadow appearance-none border rounded w-full py-2 px-3 text-grey-800 leading-tight focus:outline-none focus:shadow-outline" type="text" name="name" placeholder="A new todo"></input>
          <button class="bg-blue-500 hover:bg-blue-800 text-white font-bold ml-2 py-2 px-4 rounded focus:outline-none focus:shadow-outline" id="create" type="submit">Create</button>
        </div>
        <div class="mt-4" id="todos"></div>
      </div>
    </div>
  </body>

  <script>
    window.todos = ${todos || []}

    var updateTodos = function() {
      fetch("/", { method: 'PUT', body: JSON.stringify({ todos: window.todos }) })
      populateTodos()
    }

    var completeTodo = function(evt) {
      var checkbox = evt.target
      var todoElement = checkbox.parentNode
      var newTodoSet = [].concat(window.todos)
      var todo = newTodoSet.find(t => t.id == todoElement.dataset.todo)
      todo.completed = !todo.completed
      window.todos = newTodoSet
      updateTodos()
    }

    var populateTodos = function() {
      var todoContainer = document.querySelector("#todos")
      todoContainer.innerHTML = null

      window.todos.forEach(todo => {
        var el = document.createElement("div")
        el.className = "border-t py-4"
        el.dataset.todo = todo.id

        var name = document.createElement("span")
        name.className = todo.completed ? "line-through" : ""
        name.innerHTML = todo.name

        var checkbox = document.createElement("input")
        checkbox.className = "mx-4"
        checkbox.type = "checkbox"
        checkbox.checked = todo.completed ? 1 : 0
        checkbox.addEventListener('click', completeTodo)

        el.appendChild(checkbox)
        el.appendChild(name)
        todoContainer.appendChild(el)
      })
    }

    populateTodos()

    var createTodo = function() {
      var input = document.querySelector("input[name=name]")
      if (input.value.length) {
        window.todos = [].concat(todos, { id: window.todos.length + 1, name: input.value, completed: false })
        input.value = ""
        updateTodos()
      }
    }

    document.querySelector("#create").addEventListener('click', createTodo)
  </script>
</html>
`

const defaultData = { todos: [] }

const setCache = (key, data) => KRISTIAN_TODOS.put(key, data)
const getCache = key => KRISTIAN_TODOS.get(key)

async function getTodos(request) {
  const ip = request.headers.get('CF-Connecting-IP')
  const cacheKey = `data-${ip}`
  let data
  const cache = await getCache(cacheKey)
  if (!cache) {
    await setCache(cacheKey, JSON.stringify(defaultData))
    data = defaultData
  } else {
    data = JSON.parse(cache)
  }
  const body = html(JSON.stringify(data.todos || []))
  return new Response(body, {
    headers: { 'Content-Type': 'text/html' },
  })
}

const putInCache = (cacheKey, body) => {
  const accountId = '$accountId'
  const namespaceId = '$namespaceId'
  return fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/storage/kv/namespaces/${namespaceId}/values/${cacheKey}`,
    {
      method: 'PUT',
      body,
      headers: {
        'X-Auth-Email': '$cloudflareEmail',
        'X-Auth-Key': '$cloudflareApiKey',
      },
    },
  )
}

async function updateTodos(request) {
  const body = await request.text()
  const ip = request.headers.get('CF-Connecting-IP')
  const cacheKey = `data-${ip}`
  try {
    JSON.parse(body)
    await putInCache(cacheKey, body)
    return new Response(body, { status: 200 })
  } catch (err) {
    return new Response(err, { status: 500 })
  }
}

async function handleRequest(request) {
  if (request.method === 'PUT') {
    return updateTodos(request)
  } else {
    return getTodos(request)
  }
}

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})
```

You can find the source code for this project, as well as a README with deployment instructions, on [GitHub](https://github.com/signalnerve/cloudflare-workers-todos).
