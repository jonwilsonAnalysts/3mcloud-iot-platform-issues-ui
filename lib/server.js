// External dependencies
const fs = require("fs")
const path = require("path")
const express = require("express")
const { createWebhooksApi } = require("@octokit/webhooks")
const { createAppAuth } = require("@octokit/auth-app")
const { graphql } = require("@octokit/graphql")

// Local dependencies
const smeeClient = require(path.join(__dirname, "smee.js"))
const emojify = require(path.join(__dirname, "emojify.js"))
const hasCommand = require(path.join(__dirname, "command.js"))
const updateBodyMutationFor = require(path.join(__dirname, "mutations.js"))

// Setup
const port = 64897
const app = express()
const config = JSON.parse(fs.readFileSync("config.json", "utf8"))
const privateKey = fs.readFileSync("gh-app.pem", "utf-8")

const smee = smeeClient(config.webproxy_url, port)
smee.start()

// App

const webhooks = new createWebhooksApi({ secret: "mysecret", path: "/webhooks"})
app.use(webhooks.middleware)
webhooks.on(["issues.opened"], async(event) => {
  const { payload } = event
  const auth = await createAppAuth({
    id: config.github_app_id,
    privateKey: privateKey,
    installationId: payload.installation.id
  })
  const graphqlWithAuth = graphql.defaults({
    request: {
      hook: auth.hook
    }
  })

  const { comment, issue } = payload
  const body = ( comment || issue ).body
  const nodeId = (comment || issue ).node_id
  const newBody = "<br><br><br>Vote for this issue    &#x1f44d;"

  try {
    await graphqlWithAuth(updateBodyMutationFor(event.name), {
      newBody: body + newBody,
      id: nodeId
    })
  } catch(err) {
    console.log(err)
  }

  try {
    const testQuery = await graphqlWithAuth({
      query: "query { viewer { login } }"
    })
    console.log(testQuery)
  } catch(err) {
    console.log('Error in test query: ', err)
  }
})
webhooks.on("error", (error) => {
  console.log('Error occurred: ', error.stack)
})

const listener = app.listen(port, () => {
  console.log("Your app is listening on port " + listener.address().port)
})
