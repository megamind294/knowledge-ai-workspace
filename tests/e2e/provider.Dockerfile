FROM node:20.19.5-bookworm-slim@sha256:9e70124bd00f47dd023e349cd587132ae61892acc0e47ed641416c3e18f401c3

WORKDIR /fixture
COPY scripts/deterministic-provider.mjs ./provider.mjs
USER node
EXPOSE 8081
HEALTHCHECK --interval=2s --timeout=2s --start-period=2s --retries=15 CMD node -e "fetch('http://127.0.0.1:8081/health').then((response) => process.exit(response.ok ? 0 : 1)).catch(() => process.exit(1))"
CMD ["node", "provider.mjs"]
