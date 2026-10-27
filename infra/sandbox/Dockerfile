# Isolated logic-test image only. It does not start the production server or connect to MySQL.
FROM node:22.23-alpine
ENV NODE_ENV=test
WORKDIR /sandbox
RUN addgroup -S sbc && adduser -S -G sbc sbc
COPY enterprise/tenant-context.cjs /sandbox/enterprise/tenant-context.cjs
COPY enterprise/repositories/customer-repository.cjs /sandbox/enterprise/repositories/customer-repository.cjs
COPY scripts/tenant-repository-isolation-test.js /sandbox/scripts/tenant-repository-isolation-test.js
RUN chown -R sbc:sbc /sandbox
USER sbc
ENTRYPOINT ["node", "/sandbox/scripts/tenant-repository-isolation-test.js"]
