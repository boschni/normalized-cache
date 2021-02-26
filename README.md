# Normalized Cache

The normalized cache provides the following functionality:

- Data normalization
- Data denormalization
- Data subscriptions / change detection
- Data validation
- Optimistic updates
- Field invalidation
- Field staleness
- Garbage collection

## Setup

Installation:

```sh
npm install --save normalized-cache
```

## Usage

```js
import { Cache, schema } from "normalized-cache";

const Author = schema.object({ name: "Author" });

const Comment = schema.object({ name: "Commment" });

const Post = schema.object({
  name: "Post",
  fields: {
    author: Author,
    comments: [Comment],
  },
});

const cache = new Cache({ types: [Post] });

cache.write({
  type: "Post",
  data: {
    id: "1",
    title: "Title",
    author: {
      id: "2",
      name: "Name",
    },
    comments: [{ text: "comment" }],
  },
});

const { data } = cache.read({ type: "Post", id: "1" });
```

## Selectors

Selectors can be used to select specific fields to a certain depth:

```js
const { data } = cache.read({
  type: "Post",
  id: "1",
  select: cql`{ title comments { text } }`,
});
```

When no selector is given, all fields including related entities will be returned.

### Star

Use the star operator to select all fields on a certain level:

```js
const selector = cql`{ * comments { text } }`;
```

## Writing

When writing to the cache, a type must be provided.

```js
cache.write({
  type: "Post",
  data: { id: "1", title: "Title" },
});
```

A ID can be specified if this cannot be inferred from the data itself:

```js
cache.write({
  type: "Post",
  id: "1",
  data: { title: "Title" },
});
```

If the ID is an object or array it will be automatically serialized to a stable string:

```js
cache.write({
  type: "Posts",
  id: { page: 1, limit: 10 },
  data: [],
});
```

## Reading

Reading from the cache can be done with the `read` method.

When no selector is given, all fields and related entities will be returned:

```js
const { data } = cache.read({ type: "Post", id: postID });
```

### Selecting fields

When a selector is given, only the selected fields will be returned:

```js
const { data } = cache.read({
  type: "Post",
  id: postID,
  select: cql`{ title comments { text } }`,
});
```

### Invalid fields

Fields that do not match with the schema will be reported in the `invalidFields` array:

```js
const LoggedIn = schema.boolean({ name: "LoggedIn" })

const cache = new Cache({ types: [LoggedIn] });

cache.write({ type: "LoggedIn" data: "string" });

const { invalidFields } = cache.read({ type: "LoggedIn" });

if (invalidFields) {
  console.log("Invalid data");
}
```

### Missing fields

Fields that are missing will be reported in the `missingFields` array:

```js
const LoggedIn = schema.boolean({ name: "LoggedIn" });

const cache = new Cache({ types: [LoggedIn] });

const { missingFields } = cache.read({ type: "LoggedIn" });

if (missingFields) {
  console.log("Missing data");
}
```

### Stale flag

The `stale` flag indicates if some entity or field has been invalidated or if any `expiresAt` has past:

```js
const LoggedIn = schema.boolean({ name: "LoggedIn" });

const cache = new Cache({ types: [LoggedIn] });

cache.write({ type: "LoggedIn" data: true, expiresAt: 0 });

const { stale } = cache.read({ type: "LoggedIn" });

if (stale) {
  console.log("Stale data");
}
```

## Watching

Data in the cache can be watched with the `watch` method.

Watching for any change in a specific Post and all related data:

```js
const unsubscribe = cache.watch({
  type: "Post",
  id: postID,
  callback: (result, prevResult) => {
    // log
  },
});

unsubscribe();
```

Watching specific fields:

```js
cache.watch({
  type: "Post",
  id: postID,
  select: cql`{ title }`,
  callback: (result, prevResult) => {
    if (!prevResult.stale && result.stale) {
      // The title became stale
    }
  },
});
```

## Validation

Data validation can be done when writing and/or when reading.

## Invalidation

Entities and fields can be invalidated with the `invalidate` method.

When an entity or field is invalidated, all related watchers will be notified.

Invalidate an entity:

```js
cache.invalidate({ type: "Post", id: postID });
```

Invalidate an entity field:

```js
cache.invalidate({
  type: "Post",
  id: postID,
  select: cql`{ comments }`,
});
```

Invalidate all fields found by a selector:

```js
cache.invalidate({
  type: "Post",
  id: postID,
  select: cql`{ comments { text } }`,
});
```

## Expiration

when `expiresAt` is specified, all affected fields will be considered stale after the given time:

```js
cache.write({
  type: "Post",
  data: { id: "1" },
  expiresAt: Date.now() + 60 * 1000,
});
```

Set expiration for certain types:

```js
cache.write({
  type: "Post",
  data: { id: "1" },
  expiresAt: {
    Comment: Date.now() + 60 * 1000,
  },
});
```

## Deletion

Entities and fields can be deleted with the `delete` method.

Deleting an entity:

```js
cache.delete({ type: "Post", id: postID });
```

Deleting specific fields:

```js
cache.delete({ type: "Post", id: postID, select: cql`{ title }` });
```

## Optimistic updates

An optimistic update function can be used to update the cache optimistically.

These functions will be executed everytime the cache is updated, until they are removed.

This means that if new data is written to the cache, the optimistic update will be re-applied / rebased on top of the new data.

```js
async function addComment(postID, text) {
  function addCommentToPost(comment) {
    const { data } = cache.read({
      type: "Post",
      id: postID,
      select: cql`{ comments }`,
    });

    cache.write({
      type: "Post",
      id: postID,
      data: { comments: [...data.comments, comment] },
    });
  }

  const updateID = cache.optimisticUpdate(() => {
    const optimisticComment = { id: uuid(), text };
    addCommentToPost(optimisticComment);
  });

  const comment = await api.addComment(postID, text);

  cache.transaction(() => {
    cache.removeOptimisticUpdate(updateID);
    addCommentToPost(comment);
  });
}
```

## Merging

By default entities are shallowly merged and non-entity values are replaced.

This behavior can be customized by defining custom merge functions on entities and fields:

```js
const Author = schema.object({
  name: "Author",
  merge(existing, incoming) {
    return incoming; // Replace author entities instead of merging
  },
});

const Post = schema.object({
  fields: {
    author: Author,
    content: schema.object({
      merge(existing, incoming) {
        return { ...existing, ...incoming }; // Merge value instead of replace
      },
    }),
  },
});
```

## Transactions

Multiple changes can be wrapped in a transaction to make sure watchers are only notified once after the last change:

```js
cache.transaction(() => {
  cache.write({ type: "Post", data: { id: "1", title: "1" } });
  cache.write({ type: "Post", data: { id: "2", title: "2" } });
});
```

## Silent changes

Wrap changes with `silent` to prevent watchers from being notified:

```js
cache.silent(() => {
  cache.write({ type: "Post", data: { id: "1", title: "1" } });
});
```
