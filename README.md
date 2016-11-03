# The Surreal Cosmic Tire

This app is a surreal cosmic journey into a file uploader app using Express and backed by a sqlite file DB.

## Example Usage

First initialize everything and start it up:

```
$ npm install
$ npm run init-db
$ npm run start
```

The init-db script creates a small SQLite database file in here, `sqlite.db`.  This is an appropriate SQL
backend for a single-machine, light load application.  A larger system may use a dedicated database server 
accessible over some network connection, but for our small demo app, SQLite minimizes external dependencies and 
gets you up and running quickly.

## Endpoints

- POST `/api/file`: Initiate a file upload by supplying metadata in JSON.  Response will include a file identifier
  - `description {string}`: Description of file
  - `extension {string}`: Expected file extension, eg "csv". Do not include ".".
  - `tags {string}`: Comma-separated tags to identify this file
- PUT `/api/file/:fileId`: Upload a file with a multipart/form-data request.  File must be submitted under field name "passport"
- GET `/api/file/:fileId`: Retrieve file metadata
- GET `/api/file/:fileId/data`: Retrieve the file that was uploaded

## Example Flow

For simplicity, we will use cURL to demonstrate all the endpoints. 

Lets start by creating a file:

```
$ echo "This is a file that I will be storing in my database" > myfile.txt
```

File uploading is a two-phase process: 

```
$ curl -H "Content-Type: application/json" -X POST -d '{"description": "My Awesome File", "extension": "txt"}' localhost:3000/api/file
--> { status: 'ok',
      fileId: '783a387d-66dc-4f46-aa80-13da8be3e514',
      _links:
       { self: '/api/file/783a387d-66dc-4f46-aa80-13da8be3e514',
         data: '/api/file/783a387d-66dc-4f46-aa80-13da8be3e514/data' } }
```

Note the response gave us a fileId, as well as obeying HATEOS principles and giving us convenient URI's for followup operations.

Lets use the fileId and attach the actual file data to metadata

```
$ curl -X PUT --form "passport=@myfile.txt" localhost:3000/api/file/783a387d-66dc-4f46-aa80-13da8be3e514
{ status: 'ok',
  _links:
   { self: '/api/file/783a387d-66dc-4f46-aa80-13da8be3e514',
     data: '/api/file/783a387d-66dc-4f46-aa80-13da8be3e514/data' } }
```

Careful, the app is configured to expire metadata after 30 seconds.  If you don't submit within the alloted timeframe, 
the request will be rejected.  Rejected metas are still persisted in the database with an expired flag that allows 
statistics to be gathered.

Upon successful submission, we can view the metadata:

```
$ curl localhost:3000/api/file/783a387d-66dc-4f46-aa80-13da8be3e514
(File metadata)

$ curl localhost:3000/api/file/783a387d-66dc-4f46-aa80-13da8be3e514/data
(file contents)
```

# Additional Questions

"How do you typically manage dependencies for a project?"

In Node/javascript, npm is the go-to package manager.  Even with front-end work, with module bundlers like webpack,
npm is still the easiest way to coordinate versions across teams.  Even so, package managers do have their limits.
With semver fuzzy matching, it is possible for different developers to get different versions (and resulting bugs).
When those start happening, you can look at shrinkwrap options or even checking in your node_modules directory.


"Provide a top 3 of your favorite resources (blogs, books, people, etc...) that you
use to improve as an engineer. Please tell why you like that particular resource."

hackernews tends to be the go-to resource, but there's a high noise-to-signal ratio.  It's good to be aware of new
developments, but it's easy to get carried away by the hype.  It's when a tool starts appearing consistently that
you start to pay attention to it.  A good curated list of writings is the great SoftwareLeadWeekly newsletter -- 
geared towards technical developers, but it's a good curation of soft-skill write-ups.  Finally, finding some 
thought-leaders and following them on twitter can occasionally lead to good insights (I follow many data visualization
developers, for example).
 

"How would you test a piece of code that required access to a remote database through a network connection?"

There are two main levels of testing this:

- unit tests: Don't talk to a database, mock out the responses and focus on the behavior
- integration testing: have a CI environment that spins up a database in a known state, spins up your application,
  and can run recorded test scripts against it.  This can be a simple script run with a test-runner, or this can be
  as complicated as Selenium.
