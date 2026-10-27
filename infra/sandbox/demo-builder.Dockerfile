FROM node:22-alpine
RUN addgroup -S sbc && adduser -S -G sbc sbc
WORKDIR /sandbox
COPY workers/demo-builder.js /sandbox/demo-builder.js
RUN mkdir /sandbox/output && chown -R sbc:sbc /sandbox
USER sbc
ENV NODE_ENV=production
ENV SBC_DEMO_SANDBOX_ROOT=/sandbox/output
# Keep the demo builder isolated from the host. The orchestrator should additionally
# enforce --memory/--cpus/--pids-limit and a wall-clock timeout for each job.
ENTRYPOINT ["node","/sandbox/demo-builder.js"]

# V46.3 RESOURCE POLICY
# Runtime operators should enforce CPU/memory/pids limits at launch, for example:
#   --cpus=1 --memory=256m --pids-limit=64 --network=none
# Do not bake secrets into the image. The container is expected to run as a non-root user.
