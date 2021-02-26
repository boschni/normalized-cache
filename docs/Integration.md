# Integration

This library can be used as internal cache for fetching libraries.

Other functionality like queries, mutations and computed fields can be build on top of the cache.

The `cql` language and `schema` builders are optional features which both return an AST.

Other packages can create their own languages and translate parts of it to an AST for querying the cache.

## Ideas

### Computed fields

Computed fields can be defined with a `read` function.

This function can optionally accept arguments:

```js
const Post = schema.object({
  name: "Post",
  fields: {
    image: {
      read(post, args) {
        return post.image.replace("{size}", args.size);
      },
    },
  },
});

const selector = customql`{ image(size: "m") }`;
```

### Field directives

Field directives can be used to apply certain behaviors:

```js
const cache = new Cache({
  directives: {
    upper: {
      read(value) {
        return typeof value === "string" ? value.toUpperCase() : value;
      },
    },
  },
});

const selector = customcql`{ title @upper }`;
```

## GraphQL support

It is possible to use the cache with GraphQL, but some additional work
is needed when using field arguments or directives in your queries.

When querying a field like `image(width: 100)`, the query response will only contain an `image` field.
If the data is stored in the cache as `image` and another query is executed with `image(width: 200)`,
the result for `image(width: 100)` will be overwritten.

This means the response first needs to be transformed before storing it in the cache:

```js
cache.write({
  type: "TodoQuery",
  data: { id: "1", "image(width: 100)": "url" },
});
```

It also means that the result needs to be transformed again when reading from the cache.

Utility functions can be defined to automate the process:

```js
function graphQLWrite(options) {
  return cache.write({
    ...options,
    id: gqlIdentify(options),
    data: gqlNormalize(options),
  });
}

function graphQLRead(options) {
  const result = cache.read({
    ...options,
    id: gqlIdentify(options),
  });

  return { ...result, data: gqlDenormalize(options) };
}

const variables = { id: "1" };
const response = await fetch(TODO_QUERY, variables);

graphQLWrite({
  type: "TodoQuery",
  query: TODO_QUERY,
  variables,
  data: response,
});

graphQLRead({
  type: "TodoQuery",
  query: TODO_QUERY,
  variables,
  select: cql`{ title }`,
});
```

## Fetch library integration

- When data is fetched or updated in a query, store the data in the normalized cached
  with the specified schema and query hash and subscribe to the returned selector.
- On normalized cache update, run Query.setData.
- Unsubscribe from the selector when the last observer unsubscribes.
- Subscribe again to the selector and check data when an observer subscribes again.

```js
useQuery({
  type: PostsQuery,
  queryKey: ["posts", page, limit],
  queryFn: async () => getPosts({ page, limit }),
});
```

### GraphQL type?

A `Post` might have already been fetched in a list query for example, but the cache
does not know about the relationship between `PostQuery(id : "1")` and `Post:1`.
The `link` property can be used to link a field to an existing entity in the cache.
If all selected fields are already in the cache, there is no need to execute the resolver.
If some fields are missing, the cache can already return a partial result and fetch the missing fields.

```js
const Comment = schema.object({
  name: "Comment",
  args: { id: schema.number({ optional: false }) },
});

// Able to get from cache but it cannot resolve on its own
cql`{ Comment(id: 1) { text } }`;

const Author = schema.object({
  name: "Author",
  idFromData: (author) => author.uid,
  idFromArgs: (args) => args.uid,
  args: { uid: schema.number({ optional: false }) },
  resolve: (parent, args) => fetch(`/authors/${args.uid}`),
});

cql`{ Author(uid: 1) { name } }`;

const Post = schema.object({
  name: "Post",
  args: { id: schema.number({ optional: false }) },
  resolve: (parent, args) => fetch(`/posts/${args.id}`),
  fields: {
    comments: [Comment],
    // what if the author field also has args?
    author: schema.computed({
      type: Author,
      resolve: (post, args, ctx) =>
        ctx.query("Author", { uid: post.authorUID }),
    }),
    authors: schema.computed({
      type: [Author],
      resolve: (post, args, ctx) =>
        post.authorUIDs.map((uid) => ctx.query("Author", { uid })),
    }),
    image: schema.string({
      args: { size: schema.number() },
      resolve: (post, args) => post.image.replace("{size}", args.size),
    }),
  },
});

cql`{ Post(id: 1) { title author { name } } }`;

const Posts = schema.array({
  name: "Posts",
  args: { page: schema.number() },
  ofType: Post,
  resolve: (_, args) => fetch(`/posts?page=${args.page}`),
});

cql`{ Posts(page: 1) { title } }`;

const FeaturedPosts = schema.array({
  name: "FeaturedPosts",
  args: { page: schema.number() },
  ofType: Post,
  resolve: (_, args) => fetch(`/featured-posts?page=${args.page}`),
});

cql`{ FeaturedPosts(page: 1) { title } }`;

const Posts = schema.computed({
  name: "Post",
  args: { id: schema.number() },
  returns: Post,
  // Executes when nothing is found in the cache
  link(parent, args, cache) {
    return cache.identify("Post", { id: args.id });
  },
  // Executes when some selected data is missing from the cache
  resolve(parent, args) {
    return fetch(`/posts/${args.id}`);
  },
  // Executes when being read from the cache
  read(parent, args, cache) {},
  // Executes when being written to the cache
  write(parent, args, cache) {},
});

const selector = cql`{ PostQuery(id: "1") { title } }`;
```
