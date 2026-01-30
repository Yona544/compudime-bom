import 'dotenv/config';
import { app } from './app.js';

const port = Number(process.env.PORT) || 8001;

app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});
