"use strict";

const async = require("async");
const compiler = require("oc-webpack").compiler;
const fs = require("fs-extra");
const hashBuilder = require("oc-hash-builder");
const MemoryFS = require("memory-fs");
const path = require("path");
const reactComponentWrapper = require("oc-react-component-wrapper");

const webpackConfigurator = require("oc-webpack").configurator;
const higherOrderServerTemplate = require("./higherOrderServerTemplate");

module.exports = (options, callback) => {
  const serverFileName = options.componentPackage.oc.files.data;
  let serverPath = path.join(options.componentPath, serverFileName);
  if (process.platform === "win32") {
    serverPath = serverPath.split("\\").join("\\\\");
  }
  const publishFileName = options.publishFileName || "server.js";
  const publishPath = options.publishPath;
  const stats = options.verbose ? "verbose" : "errors-only";
  const dependencies = options.componentPackage.dependencies || {};
  const componentName = options.componentPackage.name;
  const componentVersion = options.componentPackage.version;
  const production = options.production;

  const higherOrderServerContent = higherOrderServerTemplate({
    serverPath,
    componentName,
    componentVersion,
    bundleHashKey: options.compiledViewInfo.bundle.hashKey
  });
  const tempFolder = path.join(serverPath, "../temp");
  const higherOrderServerPath = path.join(
    tempFolder,
    "__oc_higherOrderServer.js"
  );

  const config = webpackConfigurator({
    serverPath: higherOrderServerPath,
    publishFileName,
    dependencies,
    stats,
    production
  });

  async.waterfall(
    [
      next =>
        fs.outputFile(higherOrderServerPath, higherOrderServerContent, next),
      next => compiler(config, next),
      (data, next) => fs.ensureDir(publishPath, err => next(err, data)),
      (data, next) => {
        const basePath = path.join(serverPath, "../temp/build");
        const memoryFs = new MemoryFS(data);
        const compiledServer = memoryFs.readFileSync(
          `${basePath}/${config.output.filename}`,
          "UTF8"
        );
        fs.writeFile(
          path.join(publishPath, publishFileName),
          compiledServer,
          err =>
            next(
              err,
              err
                ? null
                : {
                    type: "node.js",
                    hashKey: hashBuilder.fromString(compiledServer),
                    src: publishFileName
                  }
            )
        );
      }
    ],
    (err, data) => fs.remove(tempFolder, err2 => callback(err, data))
  );
};
