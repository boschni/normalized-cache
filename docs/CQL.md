# CQL

CQL stands for "Cache Query Language" and can be used to query the cache.

Selectors can be used to select specific fields to a certain depth:

```js
import { cql } from "normalized-cache";

const result = cache.read({
  type: "Post",
  id: "1",
  select: cql`{ title comments { text } }`,
});
```

## Star operator

Use the star operator to select all fields on a certain level:

```js
const result = cache.read({
  type: "Post",
  id: "1",
  select: cql`{ * comments { text } }`,
});
```

## Non-alphanumeric fields

Quotes can be used to specify non-aplhanumeric fields:

```js
const result = cache.read({
  type: "Post",
  id: "1",
  select: cql`{ "field with spaces" { text } }`,
});
```

## Aliasing

Fields can also be aliased:

```js
const result = cache.read({
  type: "Post",
  id: "1",
  select: cql`{ myTitle: title } }`,
});
```

## Inline fragments

The `... on` syntax can be used to select fields on specific types:

```js
const Author = schema.object({
  name: "Author",
  fields: {
    name: schema.string(),
  },
  isOfType: (value) => value?.name,
});

const Post = schema.object({
  name: "Post",
  fields: {
    title: schema.string(),
  },
  isOfType: (value) => value?.title,
});

const SearchResult = schema.array({
  name: "SearchResult",
  ofType: schema.union([Author, Post]),
});

const result = cache.read({
  type: "SearchResult",
  select: cql`{
    ... on Author {
      name
    }
    ... on Post {
      title
    }
  }`,
});
```

## Fragments

Fragments can be defined to name a selection of fields:

```js
const result = cache.read({
  type: "Post",
  id: "1",
  select: cql`fragment PostOverview on Post { title }`,
});
```

They can also be embedded in other selectors:

```js
const PostOverview = cql`fragment PostOverview on Post { title }`;

const result = cache.read({
  type: "Post",
  id: "1",
  select: cql`{ ...PostOverview } ${PostOverview}`,
});
```
