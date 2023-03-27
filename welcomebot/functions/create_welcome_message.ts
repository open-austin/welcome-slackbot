import { SlackAPIClient } from "deno-slack-api/types.ts";
import { DefineFunction, Schema, SlackFunction } from "deno-slack-sdk/mod.ts";
import { SendWelcomeMessageWorkflow } from "../workflows/send_welcome_message.ts";
import { WelcomeMessageDatastore } from "../datastores/messages.ts";

export const WelcomeMessageSetupFunction = DefineFunction({
  callback_id: "welcome_message_setup_function",
  title: "Welcome Message Setup",
  description: "Takes a welcome message and stores it in the datastore",
  source_file: "functions/create_welcome_message.ts",
  input_parameters: {
    properties: {
      message: {
        type: Schema.types.string,
        description: "The welcome message",
      },
      channel: {
        type: Schema.slack.types.channel_id,
        description: "Channel to post in",
      },
      author: {
        type: Schema.slack.types.user_id,
        description:
          "The user ID of the person who created the welcome message",
      },
    },
    required: ["welcome_message", "channel"],
  },
});
export default SlackFunction(
    WelcomeMessageSetupFunction,
    async ({ inputs, client }) => {
      const uuid = crypto.randomUUID();
      const putResponse = await client.apps.datastore.put<
      typeof WelcomeMessageDatastore.definition
      >({
        datastore: WelcomeMessageDatastore.name,
        item: { id: uuid, channel, message, author },
      });
  
      if (!putResponse.ok) {
        return { error: `Failed to save welcome message: ${putResponse.error}`};
      }
  
      // Search for any existing triggers for the welcome workflow
      const triggers = await findUserJoinedChannelTrigger(client, channel);
      if (triggers.error) {
        return { error: `Failed to lookup existing triggers: ${triggers.error}` };
      }
  
      // Create a new user_joined_channel trigger if none exist
      if (!triggers.exists) {
        const newTrigger = await saveUserJoinedChannelTrigger(client, channel);
        if (!newTrigger.ok) {
          return {
            error: `Failed to create welcome trigger: ${newTrigger.error}`,
          };
        }
      }
  
      return { outputs: {} };
    },
  );