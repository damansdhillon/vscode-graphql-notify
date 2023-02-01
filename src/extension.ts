import {
  ApolloClient,
  gql,
  HttpLink,
  InMemoryCache,
  split,
} from "@apollo/client/core";
import { GraphQLWsLink } from "@apollo/client/link/subscriptions";
import { getMainDefinition } from "@apollo/client/utilities";
import { createClient } from "graphql-ws";
import fetch from "node-fetch";
import * as vscode from "vscode";
import { Subscription } from "zen-observable-ts";
import WebSocket = require("ws");

export function activate(context: vscode.ExtensionContext) {
  console.log('Congratulations, your extension "code-extension" is now active');
  vscode.window.showInformationMessage("Welcome to Code Extension!");

  // launch background task to show hello world messages. This is sample comment
  const task = vscode.tasks.registerTaskProvider("code-extension", {
    provideTasks: () => {
      const task = new vscode.Task(
        { type: "code-extension" },
        vscode.TaskScope.Workspace,
        "Code Extension",
        "code-extension",
        () => {
          vscode.window.showInformationMessage("Hello World!");
          return;
        }
      );
      task.group = vscode.TaskGroup.Build;
      return [task];
    },
    resolveTask(_task: vscode.Task): vscode.Task | undefined {
      return undefined;
    },
  });

  let disposable = vscode.commands.registerCommand(
    "code-extension.deregister-subscription",
    () => {
      const event = context.globalState.get("subscription");
      if (!event) {
        vscode.window.showErrorMessage("No existing subscription");
        return;
      }

      // Get the subscription from the somethign asdjfhgajs
      context.workspaceState
        .get<any>("subscription")
        .then((subscription: Subscription) => {
          subscription.unsubscribe();
          vscode.window.showInformationMessage(
            "Unsubscribed from Book Added event"
          );
        })
        .catch((error: string) => {
          vscode.window.showErrorMessage(error);
        });
    }
  );

  let disposable2 = vscode.commands.registerCommand(
    "code-extension.register-subscription",
    () => {
      const event = subscribeToEvent();

      // Add the event to worspace state so we can unsubscribe later
      context.workspaceState.update("subscription", event);
    }
  );

  // subscript to editor close event

  context.subscriptions.push(disposable);
  context.subscriptions.push(disposable2);
}

const subscribeToEvent = async (): Promise<Subscription> => {
  try {
    const client = getApolloClient();
    const observer = client.subscribe({
      query: gql`
        subscription Subscription {
          bookAdded {
            title
            author
          }
        }
      `,
    });
    vscode.window.showInformationMessage("Subscribed to Book Added event");

    const subscription = observer.subscribe({
      next: (data) => {
        console.log(data);
        const { title } = data.data.bookAdded;
        vscode.window.showInformationMessage(`New book "${title}" added`);
      },
      error: (error) => {
        console.log(error);
      },

      complete: () => {
        console.log("Completed");
      },
    });

    return subscription as Subscription;
  } catch (error) {
    console.log(error);
    vscode.window.showErrorMessage("Error subscribing to event");
    throw error;
  }
};

const getApolloClient = () => {
  const httpLink = new HttpLink({
    uri: "http://localhost:4000/graphql",
    fetch,
  });

  const wsLink = new GraphQLWsLink(
    createClient({
      webSocketImpl: WebSocket,
      url: "ws://localhost:4000/graphql",
    })
  );

  const link = split(
    ({ query }) => {
      const definition = getMainDefinition(query);
      return (
        definition.kind === "OperationDefinition" &&
        definition.operation === "subscription"
      );
    },
    wsLink,
    httpLink
  );

  return new ApolloClient({
    link,
    cache: new InMemoryCache(),
  });
};

// This method is called when your extension is deactivated
export function deactivate() {
  console.log("Deactivated");
  // Get workspace state and unsubscribe from event
  vscode.workspace
    .getConfiguration()
    .get<any>("subscription")
    .then((subscription: Subscription) => {
      subscription.unsubscribe();
      console.log("Unsubscribed from event");
    });
}
