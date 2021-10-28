#ifndef IGENERATORMETA_H
#define IGENERATORMETA_H
#pragma once

#include <string>
#include <vector>

using std::string;
using std::vector;

class IGeneratorMeta {
public:
  virtual const string &group() const = 0;
  virtual const string &namespace_prefix() const = 0;
  virtual bool cached() const = 0;
  virtual bool completed() const = 0;
  virtual const vector<string> &extentions() const = 0;
};
#endif