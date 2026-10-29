// Side-effect module: import it FIRST in the entry file so handlers exist
// before any other app module (DB, routes) is evaluated.
import { installGlobalErrorHandlers } from './errorReporter';

installGlobalErrorHandlers();
