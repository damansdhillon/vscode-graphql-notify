// npm install @apollo/server express graphql cors body-parser
import { ApolloServer } from "@apollo/server";
import { expressMiddleware } from "@apollo/server/express4";
import { ApolloServerPluginDrainHttpServer } from "@apollo/server/plugin/drainHttpServer";
import { makeExecutableSchema } from "@graphql-tools/schema";
import bodyParser from "body-parser";
import cors from "cors";
import express from "express";
import { PubSub } from "graphql-subscriptions";
import { useServer } from "graphql-ws/lib/use/ws";
import http from "http";
import { v4 as uuid } from "uuid";
import { WebSocketServer } from "ws";

const pubsub = new PubSub();

interface MyContext {
  token?: String;
}

const typeDefs = `#graphql
  type Book {
    id: ID!
    title: String
    author: String
  }

  # Queries
  type Query {
    books: [Book]
  }

  # Mutations
  type Mutation {
    addBook(title: String!, author: String!): Book
    updateBook(id: ID!,  book: UpdateBook!): Book
  }

  # Subscriptions
  type Subscription {
    bookAdded: Book
  }

  input UpdateBook {
    title: String!
  }
`;

const books = [];

const resolvers = {
  // eslint-disable-next-line @typescript-eslint/naming-convention
  Query: {
    books: () => books,
  },
  // eslint-disable-next-line @typescript-eslint/naming-convention
  Mutation: {
    addBook: (parent, args) => {
      const id = uuid();
      // Publish event
      pubsub.publish("BOOK_ADDED", { bookAdded: args });
      const book = { id: id, title: args.title, author: args.author };

      // Check if the book already exists
      const bookExists = books.find(
        (b) => b.title === book.title && b.author === book.author
      );

      if (bookExists) {
        return bookExists;
      }

      books.push(book);
      return book;
    },
    updateBook: (parent, args) => {
      const book = books.find((b) => b.id === args.id);

      if (!book) {
        throw new Error("Book not found");
      }

      book.title = args.book.title;

      return book;
    },
  },
  // eslint-disable-next-line @typescript-eslint/naming-convention
  Subscription: {
    bookAdded: {
      subscribe: () => {
        return pubsub.asyncIterator("BOOK_ADDED");
      },
    },
  },
};

// Make Excutable Schema
const schema = makeExecutableSchema({
  typeDefs,
  resolvers,
});

// Required logic for integrating with Express
const app = express();
// Our httpServer handles incoming requests to our Express app.
// Below, we tell Apollo Server to "drain" this httpServer,
// enabling our servers to shut down gracefully.
const httpServer = http.createServer(app);

// WebSocket Server
const wsServer = new WebSocketServer({ server: httpServer, path: "/graphql" });
const serverCleanup = useServer({ schema }, wsServer);

// Same ApolloServer initialization as before, plus the drain plugin
// for our httpServer.
const server = new ApolloServer<MyContext>({
  typeDefs,
  resolvers,
  plugins: [
    ApolloServerPluginDrainHttpServer({ httpServer }),
    // Proper shutdown for the WebSocket server.
    {
      async serverWillStart() {
        return {
          async drainServer() {
            await serverCleanup.dispose();
          },
        };
      },
    },
  ],
});
// Ensure we wait for our server to start
await server.start();

// Set up our Express middleware to handle CORS, body parsing,
// and our expressMiddleware function.
app.use(
  "/",
  cors<cors.CorsRequest>(),
  bodyParser.json(),
  // expressMiddleware accepts the same arguments:
  // an Apollo Server instance and optional configuration options
  expressMiddleware(server, {
    context: async ({ req }) => ({ token: req.headers.token }),
  })
);

// Modified server startup
const PORT = 4000;
await new Promise<void>(() =>
  httpServer.listen({ port: 4000 }, () => {
    console.log(`🚀 Query endpoint ready at http://localhost:${PORT}/graphql`);
    console.log(
      `🚀 Subscription endpoint ready at ws://localhost:${PORT}/graphql`
    );
  })
);
