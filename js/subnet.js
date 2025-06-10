let hostInputCount = 1;
let hostInputsVisible = true;
let currentTab = null; // Changed from 'subnet-calc' to null

const errorElement = document.getElementById('error');

function switchTab(tabId) {
    // If clicking the same tab that's already active, do nothing
    if (currentTab === tabId) return;
    
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    document.querySelectorAll('.tab').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // Activate selected tab and content
    document.getElementById(tabId).classList.add('active');
    currentTab = tabId;
    
    // Clear results when switching tabs
    clearResults();
}

function clearResults() {
    errorElement.textContent = '';
    errorElement.style.display = 'none';
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
        if (hostCount > 4294967296) {
            throw new Error('Please enter a number smaller than 2^32');
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
        showError(error.message);
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
        showError(error.message);
    }
}
// Add this variable at the top with your other global variables
let compactDisplay = false;

// Modify the showResults function to include the toggle button
function showResults(title, content) {
    document.getElementById('results-title').textContent = title;
    document.getElementById('results-content').innerHTML = content;
    document.getElementById('results').style.display = 'block';
    
    // Add toggle button if we're on the host-calc tab and results are visible
    if (currentTab === 'host-calc') {
        const resultsHeader = document.getElementById('results-title');
        resultsHeader.innerHTML = `
            ${title}
            <button id="toggle-display" class="compact-toggle">
                ${compactDisplay ? 'Sparse' : 'Compact'}
            </button>
        `;
        
        // Add event listener to the toggle button
        document.getElementById('toggle-display').addEventListener('click', function() {
            compactDisplay = !compactDisplay;
            // Re-run the calculation to regenerate the display
            calculateForHosts();
        });
    }
}

// Updated calculateForHosts function with fixes
function calculateForHosts() {
    clearResults();
    
    // Get input values with better validation
    const ipAddress = document.getElementById('host-ip').value.trim();
    const subnetMaskInput = document.getElementById('host-subnet').value.trim();
    const hostInputElements = document.querySelectorAll('.host-input');
    
    try {
        // Validate IP address more thoroughly
        if (!ipAddress) throw new Error('Please enter a network IP address');
        if (!isValidIp(ipAddress)) throw new Error('Invalid IP address format');
        
        // Collect and validate host requirements
        const hostRequirements = [];
        hostInputElements.forEach((input, index) => {
            const value = input.value.trim();
            if (!value) {
                if (index === 0) throw new Error('Please enter at least one host requirement');
                return; // Skip empty inputs after the first one
            }
            
            const numValue = parseInt(value);
            if (isNaN(numValue)) throw new Error(`Invalid number in host requirement: ${value}`);
            if (numValue <= 0) throw new Error(`Host requirement must be positive: ${value}`);
            if (numValue > 16777214) throw new Error(`Host requirement too large (max 16777214): ${value}`);
            
            hostRequirements.push(numValue);
        });
        
        // Sort requirements from largest to smallest
        hostRequirements.sort((a, b) => b - a);
        
        // Handle subnet mask if provided
        let parentNetwork = null;
        let parentMask = null;
        let parentCidr = null;
        
        if (subnetMaskInput) {
            parentCidr = subnetMaskInput.startsWith('/') 
                ? parseInt(subnetMaskInput.substring(1))
                : maskToCidr(subnetMaskInput);
            
            if (isNaN(parentCidr)) throw new Error('Invalid subnet mask format');
            
            parentMask = cidrToMask(parentCidr);
            parentNetwork = calculateNetworkAddress(ipAddress, parentMask);
        }
        
        // Calculate subnets
        let currentNetwork = ipToBytes(ipAddress);
        let allSubnets = [];
        let totalAllocated = 0;
        
        for (const hosts of hostRequirements) {
            // Calculate required subnet size
            const requiredSize = hosts + 2; // +2 for network and broadcast
            const hostBits = Math.max(1, Math.ceil(Math.log2(requiredSize)));
            const cidr = 32 - hostBits;
            
            // Validate against parent network if exists
            if (parentCidr !== null && cidr < parentCidr) {
                throw new Error(`Cannot create subnet larger than parent (/${parentCidr})`);
            }
            
            const subnetMask = cidrToMask(cidr);
            const subnetSize = Math.pow(2, hostBits);
            
            // Calculate network address
            const networkBytes = calculateNetworkAddressBytes(currentNetwork, ipToBytes(subnetMask));
            const networkAddress = bytesToIp(networkBytes);
            
            // Calculate broadcast address
            const broadcastBytes = calculateBroadcastAddressBytes(networkBytes, ipToBytes(subnetMask));
            const broadcastAddress = bytesToIp(broadcastBytes);
            
            // Store subnet information
            allSubnets.push({
                network: networkAddress,
                mask: subnetMask,
                cidr: cidr,
                hosts: hosts,
                totalHosts: subnetSize - 2,
                firstHost: getFirstHostAddress(networkBytes),
                lastHost: getLastHostAddress(broadcastBytes),
                broadcast: broadcastAddress,
                size: subnetSize
            });
            
            // Calculate next network address
            currentNetwork = getNextNetworkAddress(broadcastBytes);
            totalAllocated += subnetSize;
            
            // Validate we haven't exceeded address space
            if (currentNetwork[0] > 255) {
                throw new Error('Not enough address space to accommodate all host requirements');
            }
        }
        
        // Create results display
        let resultsHtml = '';
        
        // Show parent network summary if exists
        if (parentMask) {
            const parentSize = Math.pow(2, 32 - parentCidr);
            const remaining = parentSize - totalAllocated;
            
            resultsHtml += `<div class="network-summary">`;
            resultsHtml += `<p><strong>Parent Network:</strong> ${parentNetwork}/${parentCidr}</p>`;
            resultsHtml += `<p><strong>Total Allocated:</strong> ${totalAllocated} addresses (${Math.round(totalAllocated/parentSize*100)}%)</p>`;
            
            if (remaining < 0) {
                resultsHtml += `<p class="error"><strong>Warning:</strong> Network overallocated by ${-remaining} addresses</p>`;
            } else {
                resultsHtml += `<p><strong>Remaining Addresses:</strong> ${remaining} (${Math.round(remaining/parentSize*100)}%)</p>`;
            }
            
            resultsHtml += `</div>`;
        }
        
        // Add subnet results
        if (compactDisplay) {
            resultsHtml += createCompactSubnetTable(allSubnets);
        } else {
            allSubnets.forEach(subnet => {
                resultsHtml += createDetailedSubnetHtml(subnet);
            });
        }
        
        showResults('Host Allocation Results', resultsHtml);
        
    } catch (error) {
        showError(error.message);
    }
}

// Add this helper function to convert mask to CIDR
function maskToCidr(mask) {
    if (!isValidIp(mask) || !isValidSubnetMask(mask)) {
        return NaN;
    }
    return countOneBits(ipToBytes(mask));
}

// Fix the network address calculation
function calculateNetworkAddressBytes(ipBytes, maskBytes) {
    const networkBytes = [];
    for (let i = 0; i < 4; i++) {
        networkBytes.push(ipBytes[i] & maskBytes[i]);
    }
    return networkBytes;
}

// Fix the broadcast address calculation
function calculateBroadcastAddressBytes(networkBytes, maskBytes) {
    const broadcastBytes = [];
    for (let i = 0; i < 4; i++) {
        broadcastBytes.push(networkBytes[i] | (~maskBytes[i] & 0xFF));
    }
    return broadcastBytes;
}

// Helper functions for subnet calculations
function calculateNetworkAddressBytes(ipBytes, maskBytes) {
    return ipBytes.map((byte, i) => byte & maskBytes[i]);
}

function calculateBroadcastAddressBytes(networkBytes, maskBytes) {
    return networkBytes.map((byte, i) => byte | (255 ^ maskBytes[i]));
}

function getFirstHostAddress(networkBytes) {
    const firstHost = [...networkBytes];
    firstHost[3] += 1;
    return bytesToIp(firstHost);
}

function getLastHostAddress(broadcastBytes) {
    const lastHost = [...broadcastBytes];
    lastHost[3] -= 1;
    return bytesToIp(lastHost);
}

function getNextNetworkAddress(broadcastBytes) {
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
    return nextNetwork;
}
function calculateNetworkAddress(ipAddress, subnetMask) {
    const ipBytes = ipToBytes(ipAddress);
    const maskBytes = ipToBytes(subnetMask);
    const networkBytes = [];
    
    for (let i = 0; i < 4; i++) {
        networkBytes.push(ipBytes[i] & maskBytes[i]);
    }
    
    return bytesToIp(networkBytes);
}

function createCompactSubnetTable(subnets) {
    return `
        <div class="subnet-table">
            <table>
                <thead>
                    <tr>
                        <th>For Hosts</th>
                        <th>Network</th>
                        <th>First Host</th>
                        <th>Last Host</th>
                        <th>Broadcast</th>
                        <th>Mask</th>
                        <th>CIDR</th>
                    </tr>
                </thead>
                <tbody>
                    ${subnets.map(subnet => `
                        <tr>
                            <td>${subnet.hosts}</td>
                            <td>${subnet.network}/${subnet.cidr}</td>
                            <td>${subnet.firstHost}</td>
                            <td>${subnet.lastHost}</td>
                            <td>${subnet.broadcast}</td>
                            <td>${subnet.mask}</td>
                            <td>/${subnet.cidr}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
}

function createDetailedSubnetHtml(subnet) {
    return `
        <div class="subnet-result">
            <h3>Subnet for ${subnet.hosts} hosts (/${subnet.cidr})</h3>
            <p><strong>Network Address:</strong> ${subnet.network}/${subnet.cidr}</p>
            <p><strong>Usable Host Range:</strong> ${subnet.firstHost} - ${subnet.lastHost}</p>
            <p><strong>Broadcast Address:</strong> ${subnet.broadcast}</p>
            <p><strong>Total Hosts:</strong> ${subnet.totalHosts} (${subnet.size} total addresses)</p>
            <p><strong>Subnet Mask:</strong> ${subnet.mask}</p>
        </div>
    `;
}

function showError(message) {
    errorElement.textContent = message;
    errorElement.style.display = 'block';
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
    // Activate the first tab by default
    switchTab('subnet-calc');

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