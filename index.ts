import * as fs from "fs";
import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import * as cfg from "./config";
export * from "./config";

export const dnsZone = new aws.route53.Zone("infra-api-domain-zone", {
  name: cfg.apiDomain,
  tags: cfg.tags,
});

/**
 * SES - Simple Email Service
 */
new aws.ses.EmailIdentity("infra-email-contact", {email: cfg.contactEmail});

const domainIdentity = new aws.ses.DomainIdentity("infra-ses-domain-identity", {
  domain: cfg.mailDomain,
});
const sesDomainDkim = new aws.ses.DomainDkim("infra-ses-dkim", {
  domain: domainIdentity.domain,
});

const sesDkimRecords = [];

for (let i = 0; i < 3; i++) {
  sesDkimRecords.push({
    type: "CNAME",
    name: sesDomainDkim.dkimTokens.apply(
      (dkimTokens) => `${dkimTokens[i]}._domainkey.${cfg.mailDomain}`,
    ),
    value: sesDomainDkim.dkimTokens.apply(
      (dkimTokens) => `${dkimTokens[i]}.dkim.amazonses.com`,
    ),
  });
}

const mailFrom = new aws.ses.MailFrom("infra-ses-mail-from", {
  domain: domainIdentity.domain,
  mailFromDomain: pulumi.interpolate`bounces.${cfg.apiDomain}`,
});

// Route53 MX record
new aws.route53.Record("infra-ses-mail-from-mx", {
  name: mailFrom.mailFromDomain,
  records: [`10 feedback-smtp.${cfg.region}.amazonses.com`],
  ttl: 600,
  type: "MX",
  zoneId: dnsZone.id,
});

// Route53 TXT record for SPF
new aws.route53.Record("infra-ses-mail-from-txt", {
  name: mailFrom.mailFromDomain,
  records: ["v=spf1 include:amazonses.com -all"],
  ttl: 600,
  type: "TXT",
  zoneId: dnsZone.id,
});

// write DNS records to disk
pulumi
  .all([
    dnsZone.nameServers,
    sesDkimRecords,
    domainIdentity.id,
    domainIdentity.verificationToken,
  ])
  .apply(([ns, dkim, diId, diVt]) =>
    fs.writeFileSync(
      "./dns-records.json",
      JSON.stringify(
        [
          ...ns.map((n) => ({type: "NS", name: cfg.apiDomain, value: n})),
          ...dkim,
          {type: "TXT", name: `_amazonses.${diId}`, value: diVt},
        ],
        null,
        2,
      ),
    ),
  );

/**
 * DynamoDB
 */
// new aws.dynamodb.Table("infra-dynamodb", {
//   billingMode: "PROVISIONED",
//   readCapacity: 2,
//   writeCapacity: 1,
//   hashKey: "pk",
//   rangeKey: "sk",
//   tags: cfg.tags,
//   attributes: [
//     {name: "pk", type: "S"},
//     {name: "sk", type: "S"},
//     {name: "gsi1Pk", type: "S"},
//     {name: "gsi1Sk", type: "S"},
//   ],
//   globalSecondaryIndexes: [
//     {
//       readCapacity: 2,
//       writeCapacity: 1,
//       name: "GSI1",
//       hashKey: "gsi1Pk",
//       rangeKey: "gsi1Sk",
//       projectionType: "KEYS_ONLY",
//     },
//   ],
// });

// NOTE: Automatically add DKIM DNS records for SES if mailDomain is managed by Route53 as well

// const amazonsesVerificationRecord = new aws.route53.Record(
//   "amazonsesVerificationRecord",
//   {
//     name: pulumi.interpolate`_amazonses.${domainIdentity.id}`,
//     records: [domainIdentity.verificationToken],
//     ttl: 600,
//     type: "TXT",
//     zoneId: dnsZone.id,
//   },
// );
// const verification = new aws.ses.DomainIdentityVerification(
//   "verification",
//   {
//     domain: domainIdentity.id,
//   },
//   {dependsOn: [amazonsesVerificationRecord]},
// );

// const domainDkim = new aws.ses.DomainDkim("", {
//   domain: domainIdentity.domain,
// });
// const amazonsesDkimRecord: aws.route53.Record[] = [];
// for (let i = 0; i < 3; i++) {
//   amazonsesDkimRecord.push(
//     new aws.route53.Record(`amazonses_dkim_record-${i}`, {
//       name: domainDkim.dkimTokens.apply(
//         (dkimTokens) => `${dkimTokens[i]}._domainkey.${cfg.mailDomain}`,
//       ),
//       records: [
//         domainDkim.dkimTokens.apply(
//           (dkimTokens) => `${dkimTokens[i]}.dkim.amazonses.com`,
//         ),
//       ],
//       ttl: 600,
//       type: "CNAME",
//       zoneId: dnsZone.id,
//     }),
//   );
// }
