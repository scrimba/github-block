import { tw } from "twind";
import { FolderBlockProps } from "@githubnext/blocks";
import { useCallback, useEffect, useRef, useState } from "react";
import "./style.css";
import { Button, Text, Link } from "@primer/react";

const SCRIMBA_BASE_URL = import.meta.env.DEV
  ? "https://dev.scrimba.com:3000"
  : "https://scrimba.com";
const SCRIMBA_URL = `${SCRIMBA_BASE_URL}/new/htmlblocks`;

export default function (props: FolderBlockProps) {
  const { tree, context, onRequestGitHubData, files } = props;
  const [scrimMounted, setScrimMounted] = useState(false);
  const [scrimRecorded, setScrimRecorded] = useState("");

  const frame = useRef(null);

  const getFilesRecursive = useCallback(
    async (folderPath: string) => {
      const apiUrl = `/repos/${context.owner}/${context.repo}/contents/${folderPath}`;
      const folderContents = await onRequestGitHubData(apiUrl, {
        ref: context.sha,
      });

      const filePromises = folderContents.map(async (item) => {
        if (item.type === "file") {
          const fileResponse = await fetch(item.download_url);
          return { path: item.path, content: await fileResponse.text() };
        } else if (item.type === "dir") {
          const subFolderFiles = await getFilesRecursive(item.path);
          return subFolderFiles;
        }
      });

      let files = await Promise.all(filePromises)
        .then((files) => files.flat())
        .catch((error) => {
          console.error(
            `Failed to get contents of files in ${folderPath}`,
            error
          );
          return [];
        });

      return files;
    },
    [context.repo, context.owner, context.sha]
  );

  const getFiles = useCallback(
    async (all?: boolean) => {
      if (!tree && !all) {
        return [{ ...context, type: "blob", content: props.content }];
      }
      return getFilesRecursive(context.path);
    },
    [context.repo, context.owner, context.sha, files, tree, props.content]
  );

  const sendData = useCallback(
    (files, other?: boolean) => {
      if (frame.current) {
        let payload = {
          files,
          title: `Walkthrough of ${context.path.split("/").slice(-1)[0]} in ${
            context.owner
          }/${context.repo}`,
        };
        if (other) payload = files;
        frame.current.contentWindow.postMessage(payload, "*");
      }
    },
    [frame, context.owner, context.repo, context.path]
  );

  const listenToRecorded = useCallback(() => {
    window.addEventListener("message", (e) => {
      if (e.origin !== SCRIMBA_BASE_URL) return;
      if (e.data.event == "recorded") {
        setScrimRecorded(e.data.id);
      }
    });
  }, []);

  const reload = useCallback(async () => {
    let files;
    if (!tree) {
      const parts = context.path.split("/");
      const path = parts[parts.length - 1];
      files = [{ path, content: props.content, type: "blob" }];
    } else {
      files = await getFiles();
    }
    sendData(files);
    setScrimMounted(true);
    listenToRecorded();
  }, [props.content, context.path]);

  const init = useCallback(async () => {
    let files = await getFiles();
    window.addEventListener("message", (e) => {
      if (e.origin !== SCRIMBA_BASE_URL) return;

      if (e.data.mounted) {
        setScrimMounted(true);
        if (!tree) {
          const parts = context.path.split("/");
          const path = parts[parts.length - 1];
          files = [{ path, content: props.content, type: "blob" }];
        }
        sendData(files);
      }
    });
  }, [getFiles, props.content, context.path, frame]);

  const loadFiles = useCallback(async () => {
    if (!frame.current) return;
    const files = await getFiles(true);
    sendData(files);
  }, [getFiles, frame, context.folder]);

  useEffect(() => {
    if (frame.current) {
      init();
      listenToRecorded();
    }
  }, [frame]);
  const publish = useCallback(() => {
    sendData({ action: "publish" }, true);
  }, [sendData]);

  return (
    <div className={tw(`w-full h-full`)} id="example-block-code-block">
      <div className={tw(`flex w-full h-full overflow-x-hidden flex-col`)}>
        <div className={tw(`flex ai-center jc-between flex-row`)}>
          {scrimMounted ? null : (
            <Button onClick={reload}>Not working? Reload</Button>
          )}
          <Button onClick={loadFiles}>Load all files</Button>
        </div>
        {scrimRecorded ? (
          <Text>
            <Button onClick={publish} className={tw("inline-block")}>
              Publish the scrim{" "}
            </Button>
            to make it available for everyone at{" "}
            <Link
              href={`${SCRIMBA_BASE_URL}/scrim/${scrimRecorded}`}
            >{`${SCRIMBA_BASE_URL}/scrim/${scrimRecorded}`}</Link>
          </Text>
        ) : null}
        <iframe
          allow="microphone;"
          ref={frame}
          src={SCRIMBA_URL}
          className={tw`my-2 h-full w-full`}
        />
      </div>
    </div>
  );
}
