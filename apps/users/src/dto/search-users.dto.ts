import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { PageQueryDto } from '@app/common';

export class SearchUsersDto extends PageQueryDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  q: string;
}
