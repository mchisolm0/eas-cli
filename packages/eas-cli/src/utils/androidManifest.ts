const RES_XML_TYPE = 0x0003;
const RES_STRING_POOL_TYPE = 0x0001;
const RES_XML_RESOURCE_MAP_TYPE = 0x0180;
const RES_XML_START_ELEMENT_TYPE = 0x0102;
const UTF8_FLAG = 1 << 8;
const TYPE_INT_DEC = 0x10;
const TYPE_INT_HEX = 0x11;
const NO_INDEX = 0xffffffff;

// Framework resource IDs identify attributes even when their names are stripped.
const VERSION_CODE = { id: 0x0101021b, name: 'versionCode' };
const VERSION_NAME = { id: 0x0101021c, name: 'versionName' };

/**
 * Reads version attributes from the <manifest> element of a compiled (binary XML)
 * AndroidManifest.xml, as stored at the root of an APK. AAB manifests are protobuf
 * encoded and are not supported. Throws if the buffer is not a valid binary manifest.
 */
export function parseBinaryAndroidManifestVersions(buffer: Buffer): {
  versionName?: string;
  versionCode?: string;
} {
  if (buffer.readUInt16LE(0) !== RES_XML_TYPE) {
    throw new Error('Not a binary Android manifest');
  }
  let strings: string[] = [];
  let resourceIds: number[] = [];

  // Skip the RES_XML_TYPE file header and walk its child chunks.
  for (let offset = buffer.readUInt16LE(2); offset < buffer.length; ) {
    const type = buffer.readUInt16LE(offset);
    const headerSize = buffer.readUInt16LE(offset + 2);
    const size = buffer.readUInt32LE(offset + 4);

    if (type === RES_STRING_POOL_TYPE) {
      strings = readStringPool(buffer, offset);
    } else if (type === RES_XML_RESOURCE_MAP_TYPE) {
      resourceIds = Array.from({ length: (size - headerSize) / 4 }, (_, i) =>
        buffer.readUInt32LE(offset + headerSize + i * 4)
      );
    } else if (type === RES_XML_START_ELEMENT_TYPE) {
      // The first element is always <manifest>.
      const ext = offset + headerSize;
      const attributeStart = buffer.readUInt16LE(ext + 8);
      const attributeSize = buffer.readUInt16LE(ext + 10);
      const attributeCount = buffer.readUInt16LE(ext + 12);
      const is = (nameIndex: number, attr: typeof VERSION_CODE): boolean =>
        resourceIds[nameIndex] === attr.id || strings[nameIndex] === attr.name;

      const versions: { versionName?: string; versionCode?: string } = {};
      for (let i = 0; i < attributeCount; i++) {
        const attr = ext + attributeStart + i * attributeSize;
        const nameIndex = buffer.readUInt32LE(attr + 4);
        const rawValue = buffer.readUInt32LE(attr + 8);
        const dataType = buffer.readUInt8(attr + 15);
        const data = buffer.readInt32LE(attr + 16);
        if (is(nameIndex, VERSION_CODE) && [TYPE_INT_DEC, TYPE_INT_HEX].includes(dataType)) {
          versions.versionCode = String(data);
        } else if (is(nameIndex, VERSION_NAME) && rawValue !== NO_INDEX) {
          versions.versionName = strings[rawValue];
        }
      }
      return versions;
    }

    offset += size;
  }
  return {};
}

function readStringPool(buffer: Buffer, poolOffset: number): string[] {
  const headerSize = buffer.readUInt16LE(poolOffset + 2);
  const stringCount = buffer.readUInt32LE(poolOffset + 8);
  const isUtf8 = (buffer.readUInt32LE(poolOffset + 16) & UTF8_FLAG) !== 0;
  const stringsStart = poolOffset + buffer.readUInt32LE(poolOffset + 20);

  return Array.from({ length: stringCount }, (_, i) => {
    let position = stringsStart + buffer.readUInt32LE(poolOffset + headerSize + i * 4);
    if (isUtf8) {
      // UTF-8 strings store their UTF-16 length, then their byte length (1 or 2 bytes each).
      position += buffer[position] & 0x80 ? 2 : 1;
      let length = buffer[position];
      if (length & 0x80) {
        length = ((length & 0x7f) << 8) | buffer[position + 1];
        position += 1;
      }
      position += 1;
      return buffer.toString('utf8', position, position + length);
    }
    let length = buffer.readUInt16LE(position);
    if (length & 0x8000) {
      length = ((length & 0x7fff) << 16) | buffer.readUInt16LE(position + 2);
      position += 2;
    }
    position += 2;
    return buffer.toString('utf16le', position, position + length * 2);
  });
}
