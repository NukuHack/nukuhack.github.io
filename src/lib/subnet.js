// ─── Pure IPv4 / subnet math (unchanged logic from the original subnet.js) ──

export function isValidIp(ip) {
  const octets = ip.split('.');
  if (octets.length !== 4) return false;

  for (const octet of octets) {
    const num = parseInt(octet, 10);
    if (isNaN(num) || num < 0 || num > 255) return false;
  }

  return true;
}

export function ipToBytes(ip) {
  return ip.split('.').map((octet) => parseInt(octet, 10));
}

export function bytesToIp(bytes) {
  return bytes.join('.');
}

export function cidrToMask(cidr) {
  const mask = [];
  for (let i = 0; i < 4; i++) {
    const bits = Math.min(8, Math.max(0, cidr - i * 8));
    mask.push(bits === 8 ? 255 : 256 - Math.pow(2, 8 - bits));
  }
  return mask.join('.');
}

export function countOneBits(bytes) {
  let count = 0;
  for (const byte of bytes) {
    count += (byte >>> 0).toString(2).split('1').length - 1;
  }
  return count;
}

export function countZeroBits(bytes) {
  return 32 - countOneBits(bytes);
}

export function isValidSubnetMask(mask) {
  const bytes = ipToBytes(mask);
  let foundZero = false;

  for (let i = 0; i < 4; i++) {
    const byte = bytes[i];
    if (foundZero && byte !== 0) return false;

    if (
      byte !== 0 && byte !== 128 && byte !== 192 && byte !== 224 &&
      byte !== 240 && byte !== 248 && byte !== 252 && byte !== 254 && byte !== 255
    ) {
      return false;
    }

    if (byte !== 255) foundZero = true;
  }

  return true;
}

export function maskToCidr(mask) {
  if (!isValidIp(mask) || !isValidSubnetMask(mask)) return NaN;
  return countOneBits(ipToBytes(mask));
}

export function calculateNetworkAddressBytes(ipBytes, maskBytes) {
  return ipBytes.map((byte, i) => byte & maskBytes[i]);
}

export function calculateBroadcastAddressBytes(networkBytes, maskBytes) {
  return networkBytes.map((byte, i) => byte | (255 ^ maskBytes[i]));
}

export function calculateNetworkAddress(ipAddress, subnetMask) {
  const networkBytes = calculateNetworkAddressBytes(ipToBytes(ipAddress), ipToBytes(subnetMask));
  return bytesToIp(networkBytes);
}

export function getFirstHostAddress(networkBytes) {
  const firstHost = [...networkBytes];
  firstHost[3] += 1;
  return bytesToIp(firstHost);
}

export function getLastHostAddress(broadcastBytes) {
  const lastHost = [...broadcastBytes];
  lastHost[3] -= 1;
  return bytesToIp(lastHost);
}

export function getNextNetworkAddress(broadcastBytes) {
  const nextNetwork = [...broadcastBytes];
  for (let i = 3; i >= 0; i--) {
    if (nextNetwork[i] === 255) {
      nextNetwork[i] = 0;
      if (i > 0) nextNetwork[i - 1]++;
    } else {
      nextNetwork[i]++;
      break;
    }
  }
  return nextNetwork;
}

/** Basic subnet calculator: given an IP + mask, describe the network. */
export function createSubnetResult(networkAddress, subnetMask, requiredHosts = null) {
  const ipBytes = ipToBytes(networkAddress);
  const maskBytes = ipToBytes(subnetMask);
  const networkBytes = calculateNetworkAddressBytes(ipBytes, maskBytes);
  const broadcastBytes = calculateBroadcastAddressBytes(networkBytes, maskBytes);

  const broadcastAddress = bytesToIp(broadcastBytes);
  const firstHost = getFirstHostAddress(networkBytes);
  const lastHost = getLastHostAddress(broadcastBytes);

  const hostBits = countZeroBits(maskBytes);
  const totalHosts = Math.pow(2, hostBits) - 2;
  const cidr = countOneBits(maskBytes);

  return {
    requiredHosts,
    networkAddress,
    broadcastAddress,
    firstHost,
    lastHost,
    totalHosts,
    subnetMask,
    cidr,
  };
}

/** Smallest power-of-2 subnet that fits a given number of hosts. */
export function calculatePowerOfTwoResult(hostCount) {
  const requiredAddresses = hostCount + 2; // +2 for network and broadcast
  const hostBits = Math.ceil(Math.log2(requiredAddresses));
  const subnetSize = Math.pow(2, hostBits);

  const cidr = 32 - hostBits;
  const subnetMask = cidrToMask(cidr);

  const maskBytes = ipToBytes(subnetMask);
  const binaryMask = maskBytes.map((byte) => byte.toString(2).padStart(8, '0')).join(' ');

  return {
    hostCount,
    requiredAddresses,
    subnetSize,
    hostBits,
    subnetMask,
    binaryMask,
    cidr,
    usableHosts: subnetSize - 2,
  };
}

/**
 * Carves a parent network (optional) into subnets sized for each of
 * `hostRequirements`, largest first — mirrors calculateForHosts().
 */
export function calculateHostSubnets(ipAddress, subnetMaskInput, hostRequirements) {
  const sortedRequirements = [...hostRequirements].sort((a, b) => b - a);

  let parentNetwork = null;
  let parentMask = null;
  let parentCidr = null;

  if (subnetMaskInput) {
    parentCidr = subnetMaskInput.startsWith('/')
      ? parseInt(subnetMaskInput.substring(1), 10)
      : maskToCidr(subnetMaskInput);

    if (isNaN(parentCidr)) throw new Error('Invalid subnet mask format');

    parentMask = cidrToMask(parentCidr);
    parentNetwork = calculateNetworkAddress(ipAddress, parentMask);
  }

  let currentNetwork = ipToBytes(ipAddress);
  const allSubnets = [];
  let totalAllocated = 0;

  for (const hosts of sortedRequirements) {
    const requiredSize = hosts + 2;
    const hostBits = Math.max(1, Math.ceil(Math.log2(requiredSize)));
    const cidr = 32 - hostBits;

    if (parentCidr !== null && cidr < parentCidr) {
      throw new Error(`Cannot create subnet larger than parent (/${parentCidr})`);
    }

    const subnetMask = cidrToMask(cidr);
    const subnetSize = Math.pow(2, hostBits);

    const networkBytes = calculateNetworkAddressBytes(currentNetwork, ipToBytes(subnetMask));
    const networkAddress = bytesToIp(networkBytes);

    const broadcastBytes = calculateBroadcastAddressBytes(networkBytes, ipToBytes(subnetMask));
    const broadcastAddress = bytesToIp(broadcastBytes);

    allSubnets.push({
      network: networkAddress,
      mask: subnetMask,
      cidr,
      hosts,
      totalHosts: subnetSize - 2,
      firstHost: getFirstHostAddress(networkBytes),
      lastHost: getLastHostAddress(broadcastBytes),
      broadcast: broadcastAddress,
      size: subnetSize,
    });

    currentNetwork = getNextNetworkAddress(broadcastBytes);
    totalAllocated += subnetSize;

    if (currentNetwork[0] > 255) {
      throw new Error('Not enough address space to accommodate all host requirements');
    }
  }

  let parentSize = null;
  let remaining = null;
  if (parentMask) {
    parentSize = Math.pow(2, 32 - parentCidr);
    remaining = parentSize - totalAllocated;
  }

  return { parentNetwork, parentCidr, parentSize, totalAllocated, remaining, subnets: allSubnets };
}
