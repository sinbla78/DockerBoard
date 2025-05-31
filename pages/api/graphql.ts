import { ApolloServer } from 'apollo-server-micro';
import { gql } from 'apollo-server-micro';
import { NextApiRequest, NextApiResponse } from 'next';
import { getAllPosts, getPostById, createPost, deletePost, updatePost } from '../../lib/database';

// GraphQL 스키마 정의
const typeDefs = gql`
  type Post {
    id: ID!
    title: String!
    content: String!
    author: String!
    createdAt: String!
  }

  type Query {
    posts: [Post!]!
    post(id: ID!): Post
  }

  type Mutation {
    addPost(title: String!, content: String!, author: String!): Post!
    deletePost(id: ID!): Boolean!
    updatePost(id: ID!, title: String, content: String): Post
  }
`;

// GraphQL 리졸버
const resolvers = {
  Query: {
    posts: async () => {
      return await getAllPosts();
    },
    post: async (_: any, { id }: { id: string }) => {
      return await getPostById(id);
    },
  },
  Mutation: {
    addPost: async (_: any, { title, content, author }: { title: string; content: string; author: string }) => {
      return await createPost(title, content, author);
    },
    deletePost: async (_: any, { id }: { id: string }) => {
      return await deletePost(id);
    },
    updatePost: async (_: any, { id, title, content }: { id: string; title?: string; content?: string }) => {
      return await updatePost(id, title, content);
    },
  },
};

// Apollo Server 생성
const apolloServer = new ApolloServer({
  typeDefs,
  resolvers,
  introspection: true,
});

const startServer = apolloServer.start();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  await startServer;
  await apolloServer.createHandler({
    path: '/api/graphql',
  })(req, res);
}

export const config = {
  api: {
    bodyParser: false,
  },
};