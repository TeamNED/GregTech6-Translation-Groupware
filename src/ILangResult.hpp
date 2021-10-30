#ifndef ILANGRESULT_H
#define ILANGRESULT_H
#pragma once

#include <memory>
#include <string>
#include <unordered_map>
#include <vector>

using std::shared_ptr;
using std::string;
using std::unordered_map;

class ILangResult {
private:
public:
  virtual const unordered_map<string, string> *result() = 0;
};
#endif