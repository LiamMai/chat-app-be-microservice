import { InitSchema1700000000000 } from './1700000000000-InitSchema';
import { AddProfileFields1746000000000 } from './1746000000000-AddProfileFields';
import { RenameNameToFirstLastName1746500000000 } from './1746500000000-RenameNameToFirstLastName';

// Add new migrations to the END of this array — order matters.
export const migrations = [
  InitSchema1700000000000,
  AddProfileFields1746000000000,
  RenameNameToFirstLastName1746500000000,
];
