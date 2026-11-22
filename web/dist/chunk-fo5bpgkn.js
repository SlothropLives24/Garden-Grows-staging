import './chunk-bc6a6dvg.js';
import { copy } from './paint.js';

const licenceWord = (l) => (/^public domain$/i.test(l.trim()) ? copy.photoPublicDomain : l);

export { licenceWord };
