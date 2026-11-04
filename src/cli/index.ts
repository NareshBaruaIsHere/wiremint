#!/usr/bin/env node
import { createCliProgram } from "./program.js";

const program = createCliProgram();
program.parse(process.argv);

