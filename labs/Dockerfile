FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends bash coreutils findutils grep git man-db manpages python3 \
    && rm -rf /var/lib/apt/lists/* && useradd -u 1000 -m learner
COPY files.py /opt/tween-files.py
USER 1000:1000
WORKDIR /workspace
ENV HOME=/workspace TERM=xterm-256color GIT_CONFIG_NOSYSTEM=1
CMD ["sleep", "infinity"]
