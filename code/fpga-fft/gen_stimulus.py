"""Generate a multi-tone test signal for tb_fft.vhd.

Each output line is one 32-bit sample written as a binary string, the format
read by `read(line, std_logic_vector)` in the testbench:
    bits [15:0]  real part, 16-bit two's complement
    bits [31:16] imaginary part (0 for a real signal)

Example:
    python gen_stimulus.py --tones 5e6 10e6 15e6 -o input_samples.txt
"""
import argparse

import numpy as np


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--tones", type=float, nargs="+", default=[10e6], help="tone frequencies in Hz")
    p.add_argument("--fs", type=float, default=250e6, help="sample rate in Hz (default 250 MHz)")
    p.add_argument("--n", type=int, default=4096, help="number of samples (default 4096 = FFT length)")
    p.add_argument("--fullscale", type=float, default=0.9, help="peak amplitude as a fraction of 16-bit full scale")
    p.add_argument("-o", "--output", default="input_samples.txt")
    args = p.parse_args()

    t = np.arange(args.n) / args.fs
    x = sum(np.sin(2 * np.pi * f * t) for f in args.tones)
    x = x / np.max(np.abs(x)) * args.fullscale * 32767
    re = np.round(x).astype(np.int64) & 0xFFFF
    im = 0

    with open(args.output, "w") as fh:
        for r in re:
            fh.write(format((im << 16) | int(r), "032b") + "\n")

    bin_hz = args.fs / args.n
    print(f"wrote {args.n} samples to {args.output}")
    for f in args.tones:
        print(f"  {f / 1e6:g} MHz -> bin {f / bin_hz:.1f} (bin spacing {bin_hz / 1e3:.2f} kHz)")


if __name__ == "__main__":
    main()
