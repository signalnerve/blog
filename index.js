addEventListener('fetch', event => {
  event.respondWith(handleRequest(event))
})

const BUCKET_NAME = 'signalnerve'
const BUCKET_URL = `http://storage.googleapis.com/${BUCKET_NAME}`

function serveAsset(event) {
  const url = new URL(event.request.url)
  const path = url.pathname === '/' ? '/index.html' : url.pathname
  return fetch(`${BUCKET_URL}${path}`)
}

async function handleRequest(event) {
  if (event.request.method === 'GET') {
    let response = await serveAsset(event)
    if (response.status > 399) {
      response = new Response(response.statusText, { status: response.status })
    }
    return response
  } else {
    return new Response('Method not allowed', { status: 405 })
  }
}
