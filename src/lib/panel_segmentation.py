#!/usr/bin/env python3
"""
Comic Panel Segmentation Service
Based on ComicPanelSegmentation by reidenong
https://github.com/reidenong/ComicPanelSegmentation
"""

import os
import sys
import json
import base64
import numpy as np
import cv2
import math
from io import BytesIO
from PIL import Image
from skimage.feature import canny
from skimage.color import rgb2gray
from skimage.transform import probabilistic_hough_line

def protractor(line):
    """Calculate angle of a line in degrees"""
    p0, p1 = line
    x0, y0 = p0
    x1, y1 = p1
    if x1 - x0 == 0:
        angle_rad = np.arctan(np.inf)
    else:
        angle_rad = np.arctan((y1 - y0) / (x1 - x0))
    angle = angle_rad * 180 / math.pi
    return angle

def in_line(line1, line2, orientation):
    """Check if two lines are inline"""
    (p1r, p1c), (p2r, p2c) = line1
    (par, pac), (pbr, pbc) = line2

    if orientation:  # horizontal
        if (p1r == par) and (p2r == pbr):
            return True
        else:
            return False
    else:  # vertical
        if (p1c == pac) and (p2c == pbc):
            return True
        else:
            return False

def merge_line(line1, line2, orientation, distance):
    """Merge two collinear lines if they're close enough"""
    row_list = [0, 0, 0, 0]
    col_list = [0, 0, 0, 0]
    
    (row_list[0], col_list[0]), (row_list[1], col_list[1]) = line1
    (row_list[2], col_list[2]), (row_list[3], col_list[3]) = line2
    row_list.sort()
    col_list.sort()
    
    if orientation:  # horizontal, merge by column
        if col_list[2] - col_list[1] <= distance:
            return ((row_list[0], col_list[0]), (row_list[3], col_list[3]))
        else:
            return line1
    else:  # vertical, merge by row
        if row_list[2] - row_list[1] <= distance:
            return ((row_list[0], col_list[0]), (row_list[3], col_list[3]))
        else:
            return line1

def line_len(line):
    """Calculate length of a line"""
    (a, b), (c, d) = line
    return max(abs(a - c), abs(b - d))

def new_parallel_merge(lst, merge_threshold):
    """Merge parallel lines that are close together"""
    lst = list(set(lst))
    lst.sort()
    curr_xvalue = 0
    for i in range(len(lst)):
        if abs(lst[i] - curr_xvalue) <= merge_threshold:
            lst[i] = curr_xvalue
        else:
            curr_xvalue = lst[i]
    lst = list(set(lst))
    lst.sort()
    return lst

def verticalcuts(lb, ub, vlist):
    """Find vertical cutting lines within given bounds"""
    lst = []
    for line in vlist:
        (x, a), (y, b) = line
        if a <= lb and b >= ub:
            lst += [x]
    lst = list(dict.fromkeys(lst))
    if lst == []:
        return False
    else:
        return lst

def segment_manga_panels(image_base64):
    """
    Main function to segment manga panels from base64 encoded image
    Returns bounding boxes and panel images
    """
    try:
        # Decode base64 image
        image_data = base64.b64decode(image_base64)
        image = Image.open(BytesIO(image_data))
        
        # Convert to numpy array
        im = np.array(image.convert('RGB'))
        im_height, im_width = im.shape[:2]
        
        # Parameters (adjusted from original PST.py)
        hough_threshold = 70
        hough_line_length = 60
        hough_line_gap = 1
        angle_deviation = 0
        distance = 999999999
        
        # Dynamic parameters
        width_border_factor = 0.1
        height_border_factor = 0.09
        hor_line_length_factor = 0.4
        ver_line_length_factor = 0.22
        parallel_merge_dst_factor = 0.1
        
        # Calculate dynamic values
        width_border = int(width_border_factor * im_width)
        height_border = int(height_border_factor * im_height)
        hor_line_length = int(hor_line_length_factor * im_width)
        ver_line_length = int(ver_line_length_factor * im_height)
        parallel_merge_dst = int(parallel_merge_dst_factor * np.mean([im_width, im_height]))
        parallel_merge_dst = min(parallel_merge_dst, 50)  # Cap at 50 pixels
        
        # Edge detection and line detection
        grayscale = rgb2gray(im)
        edges = canny(grayscale)
        lines = probabilistic_hough_line(edges, threshold=hough_threshold, 
                                       line_length=hough_line_length, 
                                       line_gap=hough_line_gap)
        
        # Filter lines by angle (orthogonals only)
        segment_lines = []
        for line in lines:
            line_angle = protractor(line)
            if (abs(line_angle - 90) <= angle_deviation) or (abs(line_angle - 0) <= angle_deviation):
                segment_lines.append(line)
        
        # Merge inline segments
        for segment_line in segment_lines[:]:
            for segment_line2 in segment_lines[:]:
                if segment_line != segment_line2:
                    if in_line(segment_line, segment_line2, 1):  # horizontal
                        new_line = merge_line(segment_line, segment_line2, 1, distance)
                        if new_line != segment_line:
                            if segment_line in segment_lines:
                                segment_lines.remove(segment_line)
                            if segment_line2 in segment_lines:
                                segment_lines.remove(segment_line2)
                            segment_lines.append(new_line)
        
        for segment_line in segment_lines[:]:
            for segment_line2 in segment_lines[:]:
                if segment_line != segment_line2:
                    if in_line(segment_line, segment_line2, 0):  # vertical
                        new_line = merge_line(segment_line, segment_line2, 0, distance)
                        if new_line != segment_line:
                            if segment_line in segment_lines:
                                segment_lines.remove(segment_line)
                            if segment_line2 in segment_lines:
                                segment_lines.remove(segment_line2)
                            segment_lines.append(new_line)
        
        # Filter lines by length
        cutting_lines = []
        for line in segment_lines:
            if ((protractor(line) < 45 and line_len(line) >= hor_line_length) or 
                (protractor(line) > 45 and line_len(line) >= ver_line_length)):
                cutting_lines.append(line)
        
        # Extract horizontal and vertical cutting positions
        horizontal_c_pos = []
        vertical_c_pos = []
        
        for cutting_line in cutting_lines:
            if protractor(cutting_line) < 45:  # horizontal
                (p0c, p0r), (p1c, p1r) = cutting_line
                if (p0r > height_border) and (p0r < im_height - height_border):
                    horizontal_c_pos.append(p0r)
            else:  # vertical
                (p0c, p0r), (p1c, p1r) = cutting_line
                if (p0c > width_border) and (p0c < im_width - width_border):
                    lower_b, upper_b = min(p0r, p1r), max(p0r, p1r)
                    vertical_c_pos.append((p0c, lower_b, upper_b))
        
        # Merge parallel lines
        horizontal_c_pos = new_parallel_merge(horizontal_c_pos, parallel_merge_dst)
        
        # Create full-width horizontal lines
        horizontal_c_lines = []
        for hpos in horizontal_c_pos:
            horizontal_c_lines.append(((0, hpos), (im_width - 1, hpos)))
        
        # Process vertical lines with bounds
        horizontal_c_pos.insert(0, 0)
        horizontal_c_pos.append(im_height - 1)
        horizontal_c_pos.append(im_height - 1)
        
        # Adjust vertical line bounds based on horizontal lines
        for vpos_itr in range(len(vertical_c_pos)):
            for itr in range(len(horizontal_c_pos) - 1):
                if (vertical_c_pos[vpos_itr][1] >= horizontal_c_pos[itr] and 
                    vertical_c_pos[vpos_itr][1] < horizontal_c_pos[itr + 1]):
                    vertical_c_pos[vpos_itr] = (vertical_c_pos[vpos_itr][0], 
                                              horizontal_c_pos[itr], 
                                              vertical_c_pos[vpos_itr][2])
                
                if (vertical_c_pos[vpos_itr][2] <= horizontal_c_pos[itr + 1] and 
                    vertical_c_pos[vpos_itr][2] > horizontal_c_pos[itr]):
                    vertical_c_pos[vpos_itr] = (vertical_c_pos[vpos_itr][0], 
                                              vertical_c_pos[vpos_itr][1], 
                                              horizontal_c_pos[itr + 1])
        
        # Merge parallel vertical lines
        vertical_c_pos.sort(key=lambda a: a[0])
        if vertical_c_pos:
            c_pos_range = [vertical_c_pos[0][0]]
            for i in range(len(vertical_c_pos)):
                if abs(vertical_c_pos[i][0] - np.mean(c_pos_range)) <= parallel_merge_dst:
                    new_c_pos = int(np.mean(c_pos_range))
                    vertical_c_pos[i] = (new_c_pos, vertical_c_pos[i][1], vertical_c_pos[i][2])
                else:
                    c_pos_range = [vertical_c_pos[i][0]]
        
        # Create vertical cutting lines
        vertical_c_lines = []
        for vpos in vertical_c_pos:
            vertical_c_lines.append(((vpos[0], vpos[1]), (vpos[0], vpos[2])))
        
        # Generate panels
        panels = []
        order_ctr = 0
        
        # Remove duplicate horizontal positions
        horizontal_c_pos = list(set(horizontal_c_pos))
        horizontal_c_pos.sort()
        
        # Generate reading order (right-to-left, top-to-bottom for manga)
        reading_order = []
        
        for i in range(len(horizontal_c_pos) - 1):
            try:
                if verticalcuts(horizontal_c_pos[i], horizontal_c_pos[i + 1], vertical_c_lines):
                    cutting_points = verticalcuts(horizontal_c_pos[i], horizontal_c_pos[i + 1], vertical_c_lines)
                    cutting_points.insert(0, 0)
                    cutting_points.append(im_width - 1)
                    cutting_points = sorted(list(set(cutting_points)))
                    
                    # For manga reading order: right-to-left within each row
                    for j in range(len(cutting_points) - 1, 0, -1):
                        y1, y2 = horizontal_c_pos[i], horizontal_c_pos[i + 1]
                        x1, x2 = cutting_points[j - 1], cutting_points[j]
                        
                        # Extract panel image
                        panel_img = im[y1:y2, x1:x2]
                        
                        # Convert to base64
                        pil_img = Image.fromarray(panel_img)
                        buffer = BytesIO()
                        pil_img.save(buffer, format='JPEG')
                        panel_base64 = base64.b64encode(buffer.getvalue()).decode('utf-8')
                        
                        panel_data = {
                            "id": f"panel_{order_ctr}",
                            "boundingBox": {
                                "x": x1,
                                "y": y1,
                                "width": x2 - x1,
                                "height": y2 - y1
                            },
                            "imageData": panel_base64,
                            "readingOrderIndex": order_ctr
                        }
                        
                        panels.append(panel_data)
                        reading_order.append(order_ctr)
                        order_ctr += 1
                else:
                    # Single panel for this horizontal section
                    y1, y2 = horizontal_c_pos[i], horizontal_c_pos[i + 1]
                    x1, x2 = 0, im_width - 1
                    
                    panel_img = im[y1:y2, x1:x2]
                    
                    pil_img = Image.fromarray(panel_img)
                    buffer = BytesIO()
                    pil_img.save(buffer, format='JPEG')
                    panel_base64 = base64.b64encode(buffer.getvalue()).decode('utf-8')
                    
                    panel_data = {
                        "id": f"panel_{order_ctr}",
                        "boundingBox": {
                            "x": x1,
                            "y": y1,
                            "width": x2 - x1,
                            "height": y2 - y1
                        },
                        "imageData": panel_base64,
                        "readingOrderIndex": order_ctr
                    }
                    
                    panels.append(panel_data)
                    reading_order.append(order_ctr)
                    order_ctr += 1
            except (ValueError, IndexError):
                continue
        
        # If no panels found, return the whole image as a single panel
        if not panels:
            pil_img = Image.fromarray(im)
            buffer = BytesIO()
            pil_img.save(buffer, format='JPEG')
            panel_base64 = base64.b64encode(buffer.getvalue()).decode('utf-8')
            
            panels.append({
                "id": "panel_0",
                "boundingBox": {
                    "x": 0,
                    "y": 0,
                    "width": im_width,
                    "height": im_height
                },
                "imageData": panel_base64,
                "readingOrderIndex": 0
            })
            reading_order = [0]
        
        result = {
            "panels": panels,
            "totalPanels": len(panels),
            "originalImage": {
                "width": im_width,
                "height": im_height
            },
            "readingOrder": reading_order
        }
        
        return result
        
    except Exception as e:
        return {
            "error": str(e),
            "panels": [],
            "totalPanels": 0,
            "originalImage": {"width": 0, "height": 0},
            "readingOrder": []
        }

def main():
    """Main CLI interface"""
    if len(sys.argv) != 2:
        print("Usage: python panel_segmentation.py <base64_image>")
        sys.exit(1)
    
    image_base64 = sys.argv[1]
    result = segment_manga_panels(image_base64)
    print(json.dumps(result, indent=2))

if __name__ == "__main__":
    main()
