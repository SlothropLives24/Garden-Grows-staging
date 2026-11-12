import './chunk-d7aiu626.js';
import { copy } from './paint.js';

const licenceWord = (l) => (/^public domain$/i.test(l.trim()) ? copy.photoPublicDomain : l);

export { licenceWord };
