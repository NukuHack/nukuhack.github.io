let hostInputCount = 1;
let hostInputsVisible = true;
let currentTab = 'subnet-calc';

function switchTab(tabId) {
    // Hide all tab contents and deactivate all tabs
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    document.querySelectorAll('.tab').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // Activate selected tab and content
    document.getElementById(tabId).classList.add('active');
    event.currentTarget.classList.add('active');
    currentTab = tabId;
    
    // Clear results when switching tabs
    clearResults();
}

function clearResults() {
    document.getElementById('error').textContent = '';
    document.getElementById('results').style.display = 'none';
    document.getElementById('results-content').innerHTML = '';
}

function toggleHostInputs() {
    const hostInputsContainer = document.getElementById('host-inputs');
    const toggleBtn = document.querySelector('.toggle-host-inputs');
    
    hostInputsVisible = !hostInputsVisible;
    
    if (hostInputsVisible) {
        hostInputsContainer.style.display = 'block';
        toggleBtn.textContent = 'ˇ';
    } else {
        hostInputsContainer.style.display = 'none';
        toggleBtn.textContent = '^';
    }
}

function addHostInput() {
    hostInputCount++;
    const newInputId = `host-input-${hostInputCount}`;
    
    const newInput = document.createElement('div');
    newInput.className = 'host-input-container';
    newInput.id = newInputId;
    newInput.innerHTML = `
        <input type="number" class="host-input" placeholder="Number of hosts needed (e.g., 50)" min="1">
        <button class="add-host-btn" onclick="addHostInput()">+</button>
        <button class="remove-host-btn" onclick="removeHostInput('${newInputId}')">-</button>
    `;
    
    document.getElementById('host-inputs').appendChild(newInput);
}

function removeHostInput(id) {
    if (hostInputCount > 1) {
        const element = document.getElementById(id);
        element.parentNode.removeChild(element);
        hostInputCount--;
    }
}

function showResults(title, content) {
    document.getElementById('results-title').textContent = title;
    document.getElementById('results-content').innerHTML = content;
    document.getElementById('results').style.display = 'block';
}

function calculatePowerOfTwo() {
    clearResults();
    
    // Get input value
    const hostCountInput = document.getElementById('host-count').value.trim();
    
    try {
        // Validate input
        if (!hostCountInput) {
            throw new Error('Please enter a number of hosts needed');
        }
        
        const hostCount = parseInt(hostCountInput);
        if (isNaN(hostCount) || hostCount <= 0) {
            throw new Error('Please enter a positive number');
        }
        
        // Calculate the smallest power of 2 >= hostCount + 2
        const requiredAddresses = hostCount + 2; // +2 for network and broadcast
        const hostBits = Math.ceil(Math.log2(requiredAddresses));
        const subnetSize = Math.pow(2, hostBits);
        
        // Calculate CIDR and mask
        const cidr = 32 - hostBits;
        const subnetMask = cidrToMask(cidr);
        
        // Convert mask to binary
        const maskBytes = ipToBytes(subnetMask);
        let binaryMask = '';
        for (const byte of maskBytes) {
            binaryMask += byte.toString(2).padStart(8, '0') + ' ';
        }
        binaryMask = binaryMask.trim();
        
        // Create result HTML
        const resultHtml = `
            <div class="subnet-result">
                <p><strong>Number of Hosts Needed:</strong> ${hostCount}</p>
                <p><strong>Required Addresses (hosts + network + broadcast):</strong> ${requiredAddresses}</p>
                <p><strong>Smallest Power of 2 ≥ ${requiredAddresses}:</strong> ${subnetSize} (2^${hostBits})</p>
                <p><strong>Subnet Mask (Decimal):</strong> ${subnetMask}</p>
                <p><strong>Subnet Mask (Binary):</strong> <span class="binary-mask">${binaryMask}</span></p>
                <p><strong>Prefix Length:</strong> /${cidr}</p>
                <p><strong>Usable Hosts:</strong> ${subnetSize - 2}</p>
            </div>
        `;
        
        showResults('Power of 2 Calculation Results', resultHtml);
        
    } catch (error) {
        document.getElementById('error').textContent = error.message;
    }
}

function calculateSubnet() {
    clearResults();
    
    // Get input values
    const ipAddress = document.getElementById('ip').value.trim();
    let subnetMask = document.getElementById('subnet').value.trim();
    
    try {
        // Validate IP address
        if (!isValidIp(ipAddress)) {
            throw new Error('Invalid IP address format');
        }
        
        // Convert subnet mask to dotted decimal if it's in CIDR notation
        if (subnetMask.startsWith('/')) {
            const cidr = parseInt(subnetMask.substring(1));
            if (isNaN(cidr) || cidr < 0 || cidr > 32) {
                throw new Error('CIDR notation must be between /0 and /32');
            }
            subnetMask = cidrToMask(cidr);
        }
        
        // Validate subnet mask
        if (!isValidIp(subnetMask) || !isValidSubnetMask(subnetMask)) {
            throw new Error('Invalid subnet mask format');
        }
        
        // Calculate and display results
        const resultHtml = createSubnetResultHtml(ipAddress, subnetMask);
        showResults('Subnet Calculation Results', resultHtml);
        
    } catch (error) {
        document.getElementById('error').textContent = error.message;
    }
}

function calculateForHosts() {
    clearResults();
    
    // Get input values
    const ipAddress = document.getElementById('host-ip').value.trim();
    const subnetMaskInput = document.getElementById('host-subnet').value.trim();
    const hostInputs = document.querySelectorAll('.host-input');
    
    try {
        // Validate IP address
        if (!isValidIp(ipAddress)) {
            throw new Error('Invalid IP address format');
        }
        
        // Get and validate host requirements
        const hostRequirements = [];
        hostInputs.forEach(input => {
            const value = parseInt(input.value.trim());
            if (!isNaN(value) && value > 0) {
                hostRequirements.push(value);
            }
        });
        
        if (hostRequirements.length === 0) {
            throw new Error('Please enter at least one valid host requirement');
        }
        
        // Sort requirements from largest to smallest
        hostRequirements.sort((a, b) => b - a);
        
        // Calculate total required hosts (with network and broadcast addresses)
        const totalRequired = hostRequirements.reduce((sum, hosts) => sum + hosts + 2, 0);
        
        // If subnet mask is provided, validate it fits all requirements
        let parentSubnetMask = null;
        let parentCidr = null;
        let totalAvailable = null;
        
        if (subnetMaskInput) {
            parentSubnetMask = subnetMaskInput.startsWith('/') ? 
                cidrToMask(parseInt(subnetMaskInput.substring(1))) : 
                subnetMaskInput;
            
            if (!isValidIp(parentSubnetMask) || !isValidSubnetMask(parentSubnetMask)) {
                throw new Error('Invalid subnet mask format');
            }
            
            parentCidr = countOneBits(ipToBytes(parentSubnetMask));
            const parentHostBits = 32 - parentCidr;
            totalAvailable = Math.pow(2, parentHostBits);
            
            if (totalRequired > totalAvailable) {
                throw new Error(`Subnet mask /${parentCidr} only provides ${totalAvailable} addresses, but ${totalRequired} are needed`);
            }
        }
        
        // Calculate subnets for each requirement
        let currentNetwork = ipToBytes(ipAddress);
        let resultsHtml = '';
        let allSubnets = [];
        let totalAllocated = 0;
        
        for (const hosts of hostRequirements) {
            // Calculate the smallest subnet that can accommodate the required hosts
            const hostBits = Math.ceil(Math.log2(hosts + 2)); // +2 for network and broadcast
            const cidr = 32 - hostBits;
            
            if (cidr < 0) {
                throw new Error(`Required number of hosts (${hosts}) is too large for any subnet`);
            }
            
            // If we have a parent subnet, ensure we don't exceed it
            if (parentCidr !== null && cidr < parentCidr) {
                throw new Error(`Cannot create subnet larger than parent (/${parentCidr})`);
            }
            
            const subnetMask = cidrToMask(cidr);
            const maskBytes = ipToBytes(subnetMask);
            
            // Calculate network address
            const networkBytes = [];
            for (let i = 0; i < 4; i++) {
                networkBytes.push(currentNetwork[i] & maskBytes[i]);
            }
            
            const networkAddress = bytesToIp(networkBytes);
            
            // Calculate broadcast address
            const broadcastBytes = [];
            for (let i = 0; i < 4; i++) {
                broadcastBytes.push(currentNetwork[i] | (255 ^ maskBytes[i]));
            }
            
            // Calculate next network address
            const nextNetwork = [...broadcastBytes];
            for (let i = 3; i >= 0; i--) {
                if (nextNetwork[i] === 255) {
                    nextNetwork[i] = 0;
                    if (i > 0) nextNetwork[i-1]++;
                } else {
                    nextNetwork[i]++;
                    break;
                }
            }
            
            // Add subnet info
            const subnetSize = Math.pow(2, 32 - cidr);
            totalAllocated += subnetSize;
            
            allSubnets.push({
                network: networkAddress,
                mask: subnetMask,
                cidr: cidr,
                hosts: hosts,
                totalHosts: subnetSize - 2,
                firstHost: bytesToIp([networkBytes[0], networkBytes[1], networkBytes[2], networkBytes[3] + 1]),
                lastHost: bytesToIp([broadcastBytes[0], broadcastBytes[1], broadcastBytes[2], broadcastBytes[3] - 1]),
                broadcast: bytesToIp(broadcastBytes)
            });
            
            // Set current network to next network for next iteration
            currentNetwork = nextNetwork;
            
            // Validate we haven't exceeded the address space
            if (currentNetwork[0] > 255) {
                throw new Error('Not enough address space to accommodate all host requirements');
            }
        }
        
        // Display results header with summary
        let headerHtml = '';
        if (parentSubnetMask) {
            const remaining = totalAvailable - totalAllocated;
            
            if (remaining === 0) {
                headerHtml = `<div class="full-network">This allocation fully saturates the network (no remaining IPs)</div>`;
            } else if (remaining < 0) {
                headerHtml = `<div class="remaining-ips negative">Remaining IPs in network: ${remaining} (${Math.round(remaining/totalAvailable*100)}% of total) - WARNING: Network overallocated!</div>`;
            } else {
                headerHtml = `<div class="remaining-ips">Remaining IPs in network: ${remaining} (${Math.round(remaining/totalAvailable*100)}% of total)</div>`;
            }
        }
        
        // Display results in compact grid format if more than 3 subnets
        if (allSubnets.length > 3) {
            resultsHtml = '<div class="subnet-grid">';
            allSubnets.forEach(subnet => {
                resultsHtml += `
                    <div class="subnet-compact">
                        <div class="subnet-header">Subnet for ${subnet.hosts} hosts (/${subnet.cidr})</div>
                        <div class="subnet-details">
                            <div>Network:</div><div>${subnet.network}</div>
                            <div>First Host:</div><div>${subnet.firstHost}</div>
                            <div>Last Host:</div><div>${subnet.lastHost}</div>
                            <div>Broadcast:</div><div>${subnet.broadcast}</div>
                            <div>Total Hosts:</div><div>${subnet.totalHosts}</div>
                            <div>Subnet Mask:</div><div>${subnet.mask}</div>
                        </div>
                    </div>
                `;
            });
            resultsHtml += '</div>';
        } else {
            // Display in full format for 1-3 subnets
            allSubnets.forEach(subnet => {
                resultsHtml += createSubnetResultHtml(subnet.network, subnet.mask, subnet.hosts);
            });
        }
        
        showResults('Host Allocation Results', headerHtml + resultsHtml);
        
    } catch (error) {
        document.getElementById('error').textContent = error.message;
    }
}

function createSubnetResultHtml(networkAddress, subnetMask, requiredHosts = null) {
    const ipBytes = ipToBytes(networkAddress);
    const maskBytes = ipToBytes(subnetMask);
    const networkBytes = [];
    const broadcastBytes = [];
    
    for (let i = 0; i < 4; i++) {
        networkBytes.push(ipBytes[i] & maskBytes[i]);
        broadcastBytes.push(ipBytes[i] | (255 ^ maskBytes[i]));
    }
    
    const broadcastAddress = bytesToIp(broadcastBytes);
    
    // Calculate first and last host
    const firstHostBytes = [...networkBytes];
    firstHostBytes[3] += 1;
    const firstHost = bytesToIp(firstHostBytes);
    
    const lastHostBytes = [...broadcastBytes];
    lastHostBytes[3] -= 1;
    const lastHost = bytesToIp(lastHostBytes);
    
    // Calculate total hosts
    const hostBits = countZeroBits(maskBytes);
    const totalHosts = Math.pow(2, hostBits) - 2;
    
    // Calculate CIDR notation
    const cidr = countOneBits(maskBytes);
    
    // Create HTML
    let html = `<div class="subnet-result">`;
    if (requiredHosts !== null) {
        html += `<h3>Subnet for ${requiredHosts} hosts (/${cidr})</h3>`;
    }
    html += `
        <p><strong>Network Address:</strong> ${networkAddress}</p>
        <p><strong>Broadcast Address:</strong> ${broadcastAddress}</p>
        <p><strong>First Host:</strong> ${firstHost}</p>
        <p><strong>Last Host:</strong> ${lastHost}</p>
        <p><strong>Total Hosts:</strong> ${totalHosts}</p>
        <p><strong>Subnet Mask:</strong> ${subnetMask}</p>
    </div>`;
    
    return html;
}

// Helper functions
function isValidIp(ip) {
    const octets = ip.split('.');
    if (octets.length !== 4) return false;
    
    for (const octet of octets) {
        const num = parseInt(octet);
        if (isNaN(num) || num < 0 || num > 255) return false;
    }
    
    return true;
}

function isValidSubnetMask(mask) {
    const bytes = ipToBytes(mask);
    let foundZero = false;
    
    for (let i = 0; i < 4; i++) {
        const byte = bytes[i];
        if (foundZero && byte !== 0) return false;
        
        // Check that the byte is a valid subnet mask byte
        if (byte !== 0 && byte !== 128 && byte !== 192 && byte !== 224 && 
            byte !== 240 && byte !== 248 && byte !== 252 && byte !== 254 && byte !== 255) {
            return false;
        }
        
        if (byte !== 255) foundZero = true;
    }
    
    return true;
}

function ipToBytes(ip) {
    return ip.split('.').map(octet => parseInt(octet));
}

function bytesToIp(bytes) {
    return bytes.join('.');
}

function cidrToMask(cidr) {
    let mask = [];
    for (let i = 0; i < 4; i++) {
        const bits = Math.min(8, Math.max(0, cidr - i * 8));
        mask.push(bits === 8 ? 255 : 256 - Math.pow(2, 8 - bits));
    }
    return mask.join('.');
}

function countOneBits(bytes) {
    let count = 0;
    for (const byte of bytes) {
        count += (byte >>> 0).toString(2).split('1').length - 1;
    }
    return count;
}

function countZeroBits(bytes) {
    return 32 - countOneBits(bytes);
}

// Quality of Life Improvements
document.addEventListener('DOMContentLoaded', function() {
    // Add example values on click for better UX
    document.getElementById('ip').addEventListener('focus', function() {
        if (!this.value) this.value = '192.168.1.1';
    });
    
    document.getElementById('subnet').addEventListener('focus', function() {
        if (!this.value) this.value = '255.255.255.0';
    });
    
    document.getElementById('host-ip').addEventListener('focus', function() {
        if (!this.value) this.value = '192.168.1.0';
    });
    
    document.getElementById('host-subnet').addEventListener('focus', function() {
        if (!this.value) this.value = '/24';
    });
    
    document.getElementById('host-count').addEventListener('focus', function() {
        if (!this.value) this.value = '50';
    });
    
    // Allow pressing Enter to calculate
    document.querySelectorAll('input').forEach(input => {
        input.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                switch(currentTab) {
                    case 'subnet-calc': calculateSubnet(); break;
                    case 'host-calc': calculateForHosts(); break;
                    case 'power-calc': calculatePowerOfTwo(); break;
                }
            }
        });
    });
});