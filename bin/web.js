#!/usr/bin/env node

import { startServer } from '../lib/server.js';

const port = Number(process.env.PORT) || Number(process.argv[2]) || 3847;
startServer(port);
