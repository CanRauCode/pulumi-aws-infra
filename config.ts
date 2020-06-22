import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";

const cfg = new pulumi.Config();

export const projectName = pulumi.getProject();
export const stackName = pulumi.getStack();
export const env = stackName.split(".")[1];

export const tags = {
  "user:Project": pulumi.getProject(),
  "user:Stack": stackName,
};

export const region = aws.config.requireRegion();
export const originDomain = cfg.require("originDomain");
export const apiDomain = cfg.require("apiDomain");
export const mailDomain = cfg.require("mailDomain");
export const contactEmail = cfg.require("contactEmail");
