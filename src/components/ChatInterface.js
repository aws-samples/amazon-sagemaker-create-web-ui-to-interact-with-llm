import "../App.css";

import awsConfig from "../configs/aws.json";
import modelsConfig from "../configs/models.json";
import localConfig from "../configs/local.json";

import React from "react";

import {
  AppLayout,
  Button,
  Container,
  Form,
  FormField,
  Header,
  SpaceBetween,
  TextContent,
  Select,
  Textarea,
} from "@cloudscape-design/components";

const AWS = require("aws-sdk");

AWS.config.update(awsConfig);

const lambda = new AWS.Lambda();

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

class ChatInterface extends React.Component {
  constructor(props) {
    super(props);
    const models = (Object.entries(modelsConfig) || []).map(([key, value]) => {
      return { label: key, value: key };
    });
    console.log("models:", models);

    this.state = {
      chats: [
        {
          role: localConfig.bot_profile_name,
          content: "Welcome to Chat Studio!",
          photo_base64s: [],
        },
        // {
        //   role: localConfig.human_profile_name,
        //   content: "what is love?",
        // },
      ],
      modelName: models && models.length > 0 ? models[0] : null,
      textInputs: "",
      reply: {},
      loading: false,
      models: models,
    };
  }

  updateChat = (role, content, photo_base64s = []) => {
    this.setState((previousState) => ({
      chats: [
        ...previousState.chats,
        {
          role: role,
          content: content,
          photo_base64s: photo_base64s,
        },
      ],
    }));
  };

  call = (event) => {
    event.preventDefault();
    console.log("Submitted:");

    if (this.state.modelName.value === "") {
      alert("Please select a model in the top right corner first");
      return;
    }

    this.setState({ reply: {} });
    this.updateChat(localConfig.human_profile_name, this.state.textInputs);

    let params = {
      FunctionName: localConfig.lambda_function_name,
      InvocationType: "RequestResponse",
    };

    const endpoint_name =
      modelsConfig[this.state.modelName.value].endpoint_name;
    let Payload = {
      endpoint_name: endpoint_name,
    };

    let payload = modelsConfig[this.state.modelName.value].payload;

    // parse inputs according to model
    if (endpoint_name.includes("llama")) {
      console.log(this.state.chats);
      let llamaInputs = this.state.chats.map(
        ({ photo_base64s, ...object }) => object // rm photo_base64s keys from inputs
      );
      llamaInputs.push({
        // add latest user question to inputs
        role: localConfig.human_profile_name,
        content: this.state.textInputs,
      });
      llamaInputs.shift(); // delete first element (welcome message)
      payload[localConfig.request_text_inputs_key] = [llamaInputs]; // need to wrap in another []
      console.log(llamaInputs);
    } else payload[localConfig.request_text_inputs_key] = this.state.textInputs;

    Payload["payload"] = payload;

    params.Payload = JSON.stringify(Payload);
    console.log(params);

    // clear text box and disable text box and disable search button
    this.setState({ textInputs: "", loading: true });

    lambda.invoke(
      params,
      function (err, data) {
        if (err) {
          console.error("Error invoking Lambda function:", err);
          this.updateChat(localConfig.bot_profile_name, JSON.stringify(err));
          this.setState({ loading: false });
        } else {
          try {
            console.log("Lambda function response:", data.Payload);
            console.log(data.Payload);
            const response = JSON.parse(data.Payload);
            console.log(response);

            const body = JSON.parse(response["body"]);
            console.log(body);

            this.updateChat(
              localConfig.bot_profile_name,
              body["text"],
              body["photo_base64s"]
            );
          } catch (err) {
            this.updateChat(
              localConfig.bot_profile_name,
              "An error has occurred: " + JSON.stringify(err)
            );
          }
          this.setState({ loading: false });
        }
      }.bind(this)
    );
  };

  validateForm = () => {
    return this.state.textInputs && this.state.textInputs !== "";
  };

  render() {
    const showButton = this.validateForm();

    return (
      <AppLayout
        toolsHide={true}
        navigationHide={true}
        contentHeader={
          <>
            <Header variant="h1">Chat Studio 💬</Header>
            <Container>
              <form onSubmit={this.call}>
                <Form
                  // onSubmit={this.call}
                  actions={
                    <Button
                      variant="primary"
                      type="submit"
                      disabled={!showButton || this.state.loading}
                    >
                      {this.state.loading ? "Loading..." : "Send"}
                    </Button>
                  }
                >
                  <SpaceBetween size="l">
                    <FormField
                      label="Search query"
                      description="The query which you would like to make to the selected foundational model."
                    >
                      {/* <Input type="search" placeholder="Choose an S3 bucket" /> */}
                      <Textarea
                        onChange={({ detail }) =>
                          this.setState({ textInputs: detail.value })
                        }
                        placeholder={
                          this.state.loading
                            ? "Please wait..."
                            : "Ask away here!"
                        }
                        value={this.state.textInputs}
                        disabled={this.state.loading}
                      />
                    </FormField>
                    <FormField
                      label="Foundational model"
                      description="The foundational model which you have deployed that you want to use."
                    >
                      <Select
                        selectedOption={this.state.modelName}
                        onChange={({ detail }) =>
                          this.setState({ modelName: detail.selectedOption })
                        }
                        placeholder="Choose an option"
                        empty="No options"
                        options={this.state.models}
                        disabled={this.state.loading}
                      />
                    </FormField>
                  </SpaceBetween>
                </Form>
              </form>
            </Container>

            {/* This React app uses Cloudscape components. Learn more in{" "}
                <Link
                  href="https://cloudscape.design"
                  external
                  externalIconAriaLabel="Opens in a new tab"
                >
                  the official documentation.
                </Link> */}
          </>
        }
        content={
          <>
            <SpaceBetween direction="vertical" size="l">
              {this.state.chats.map(function (d) {
                if (d.role === localConfig.bot_profile_name)
                  return (
                    <Container style={{ flex: 1, flexDirection: "row" }}>
                      <SpaceBetween direction="vertical" size="l">
                        <TextContent>
                          <h2 style={{ textAlign: "left" }}>
                            {capitalize(d.role)} 🤖
                          </h2>
                          {d.content.split("\n").map((paragraph) => (
                            <p style={{ textAlign: "left" }}>{paragraph}</p>
                          ))}
                        </TextContent>
                        <SpaceBetween
                          className="justify"
                          style={{ justifyContent: "center" }}
                          direction="horizontal"
                          size="s"
                          // alignItems="stretch"
                        >
                          {d.photo_base64s.map((photo_base64) => (
                            <img
                              src={`data:image/jpeg;base64,${photo_base64}`}
                              style={{ borderRadius: 20 }}
                              alt="Pexels"
                            />
                          ))}
                        </SpaceBetween>
                      </SpaceBetween>
                    </Container>
                  );
                else
                  return (
                    <Container style={{ flex: 1, flexDirection: "row" }}>
                      <TextContent>
                        <h2 style={{ textAlign: "right" }}>
                          🧑 {capitalize(d.role)}
                        </h2>
                        {d.content.split("\n").map((paragraph) => (
                          <p style={{ textAlign: "right" }}>{paragraph}</p>
                        ))}
                      </TextContent>
                    </Container>
                  );
              })}
            </SpaceBetween>
          </>
        }
      />
    );
  }
}

export default ChatInterface;
